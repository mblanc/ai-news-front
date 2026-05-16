# Spec: AI News Ingestion Pipeline

> Status: Draft · 2026-05-16  
> Scope: Phase 1 — manual-trigger, sequential, web scraping + admin source management UI

---

## 1. Objective

Add a server-side ingestion pipeline triggered by `POST /api/ingest`. When called, it:

1. Fetches article content from a Firestore-managed list of source URLs (editable by admin users via `/admin/sources`)
2. Deduplicates against existing Firestore records
3. Scores each article's relevance to AI topics using Gemini
4. Generates embeddings and clusters similar articles together
5. Summarises each cluster and persists clusters + articles to Firestore

The feed page (`/`) currently reads from the `news` Firestore collection. Once the pipeline is in place it will be updated to read from `clusters` instead — both multi-article clusters (with AI-generated summaries) and singleton clusters (single article, excerpt used as display text). Each cluster card lists all its source articles (title, URL, domain). The `news` collection is kept as-is and will be retired once the new feed is verified.

---

## 2. Commands

```bash
npm run dev      # start dev server (pipeline route available at localhost:3000/api/ingest)
npm run build    # production build
npm run lint     # ESLint
npx tsc --noEmit # type-check

# Trigger the pipeline manually
curl -X POST http://localhost:3000/api/ingest
```

No dedicated test runner. Manual `curl` and Firestore console are the verification tools.

---

## 3. Source scraping strategy

### Recommendation: keep the existing Readability stack

The app already ships `@mozilla/readability`, `jsdom`, and `turndown` in `lib/ai-utils.ts`. This covers most news sites cleanly. It is free, runs in-process, and requires no external API key.

**Use Firecrawl only as a fallback** for JS-rendered pages that Readability cannot parse (returns empty content). Firecrawl costs money per page and requires `FIRECRAWL_API_KEY` — add it as an optional env var. The pipeline should:

1. Try Readability first
2. If `article.content` is empty or < 200 characters, attempt Firecrawl (if key is configured)
3. If neither succeeds, mark the article as `status: 'fetch_failed'` and skip

For RSS feeds: the source list may include RSS URLs (`.xml`, `/feed`, `/rss`). Add `rss-parser` to parse them into article URLs, then scrape each URL with the same Readability flow.

---

## 4. Project structure

New files to create:

```
lib/
  ingest.ts           # orchestrator: runs all pipeline steps sequentially
  scrape.ts           # fetchArticle(): Readability → ExtractedContent (extract from ai-utils.ts)
  rss.ts              # parseRssFeed(): rss-parser → string[] of article URLs
  cluster.ts          # embed(), cosineSimilarity(), clusterArticles()
  hash.ts             # sha256(url): string

app/
  admin/
    sources/
      page.tsx        # admin sources management UI

app/api/
  ingest/
    route.ts          # POST handler — calls ingest(), returns stats JSON
  sources/
    route.ts          # GET (list) + POST (create) sources
    [id]/
      route.ts        # PATCH (update/toggle) + DELETE source

firestore/
  (existing dir, no new indexes needed for Phase 1)
```

New Firestore collections:

```
sources/{sourceId}
  url: string          # URL as entered by the admin (RSS feed or listing page)
  type: 'rss' | 'page' # auto-detected on creation; rss → parse feed; page → autodiscover feed or scrape links
  feedUrl: string?     # populated by autodiscovery; used on subsequent runs to skip re-fetching the listing page
  name: string         # human label shown in admin UI
  enabled: boolean     # toggle without deleting
  createdAt: Timestamp

articles/{articleId}
  url: string
  urlHash: string          # sha256(url), used for dedup
  title: string
  domain: string
  bodyMd: string
  excerpt: string
  relevanceScore: number   # 0–10
  embedding: number[]      # from gemini-embedding-2
  status: 'raw' | 'scored' | 'clustered' | 'fetch_failed' | 'discarded'
  ingestedAt: Timestamp

clusters/{clusterId}
  summary: string          # AI-generated cluster summary
  topicTag: string         # 'model-release' | 'research' | 'funding' | 'product' | 'policy' | 'other'
  sentiment: 'positive' | 'neutral' | 'negative'
  entities: string[]       # named entities extracted by Gemini
  isSingleton: boolean     # true when cluster has only 1 article (no summary generated)
  articles: Array<{        # denormalized for read performance — no join needed in the feed
    id: string
    title: string
    url: string
    domain: string
    excerpt: string
    relevanceScore: number
  }>
  articleCount: number
  createdAt: Timestamp
```

The existing `news` collection and read layer are untouched in this phase.

---

## 5. Pipeline steps (sequential, single request)

### Step 1 — Load sources

Query Firestore `sources` collection for all docs where `enabled == true`. If none exist, the pipeline returns early with a `sources: 0` stat — no error.

### Step 2 — Fetch article URLs

- For `type: 'rss'`: call `parseRssFeed(url)` → array of `{ url, pubDate }` objects. Filter to items where `pubDate` is within the last 3 days (72 hours from now). Cap at 20 items per feed after filtering. RSS items without a `pubDate` are included (can't confirm age, safer to keep).
- For `type: 'page'`: the URL points to a site's listing/home page, not a single article. Resolution order:
  1. **RSS autodiscovery** — fetch the page HTML and look for `<link rel="alternate" type="application/rss+xml">` or `type="application/atom+xml"` in `<head>`. If found, treat the discovered feed URL exactly like a `type: 'rss'` source (parse feed, apply 3-day filter, cap at 20 items). Persist the discovered feed URL back to the Firestore `sources` doc (`feedUrl` field) so future runs skip the autodiscovery step.
  2. **Link scraping fallback** — if no feed link is found, run Readability on the listing page to extract the main content block, then pass the result to the configured `INGEST_MODEL` with a prompt asking it to return a JSON array of article URLs from the last 3 days. Scrape each individually. Apply the post-scrape date filter described below.

     Prompt sketch:

     ```
     Extract article URLs published in the last 3 days from the following webpage content.
     Today's date is {isoDate}.
     Return only a JSON array of absolute URLs: ["https://...", ...]
     If a URL is relative, resolve it against the base URL: {baseUrl}
     If a publication date is visible next to a link, exclude articles older than 3 days.
     If no date is visible for an article, include it (date will be verified after fetching).
     Ignore pagination, tag, category, and author links.

     Content:
     {readabilityMarkdown}
     ```

     The LLM filter is best-effort (dates may not be present in the listing). The post-scrape date filter below is the authoritative gate.

- All resolved article URLs are collected into a flat deduplicated list before scraping.

**Post-scrape date filter (link-scraping fallback only)**: after scraping an individual article, attempt to extract a publication date from `<meta>` tags (`article:published_time`, `datePublished`). If a date is found and it is older than 3 days, skip the article. If no date can be extracted, keep it.

### Step 3 — Dedup check

For each URL, compute `sha256(url)`. Query Firestore `articles` collection for an existing doc with `urlHash == hash`. Skip if found. This prevents re-ingesting the same article on repeated runs.

### Step 4 — Scrape articles

For each new URL:

- Call `fetchArticle(url)` (Readability path from `lib/scrape.ts`)
- If the HTTP response status is 4xx or 5xx, mark `status: 'fetch_failed'` immediately — do not attempt Firecrawl
- If the response is 200 but Readability returns `null` or the extracted `bodyMd` has fewer than 50 words (strip markdown syntax before counting) and `FIRECRAWL_API_KEY` is set, retry via Firecrawl HTTP API
- Write a Firestore `articles` doc with `status: 'raw'` (or `'fetch_failed'` on failure)

### Step 5 — Relevance scoring

Batch articles (≤ 10 at a time). For each batch, call Gemini with a prompt:

```
Score the relevance of this article to the topic of AI/machine learning (0–10).
Output only a JSON object: { "score": <number> }
Article title: {title}
Excerpt: {excerpt}
```

- Model: `INGEST_MODEL` constant
- Articles scoring < 5 → set `status: 'discarded'`, skip remaining steps
- Articles scoring ≥ 5 → set `status: 'scored'`, proceed

### Step 6 — Embeddings

For remaining articles, generate an embedding using Vertex AI `gemini-embedding-2`:

```typescript
const embedding = await ai.models.embedContent({
  model: "gemini-embedding-2",
  content: `${title}\n\n${excerpt}`,
})
```

Store `embedding` on the Firestore `articles` doc.

### Step 7 — Clustering

Greedy cosine clustering in-memory (no external service needed):

1. Load all `status: 'scored'` articles with embeddings from this run
2. For each unassigned article, compute cosine similarity against all cluster centroids
3. If max similarity ≥ 0.82, assign to that cluster and recompute centroid (mean of member embeddings)
4. Otherwise, start a new cluster with this article as seed
5. Write a `clusters` doc for every cluster, including singletons (`isSingleton: true`). Singletons skip Step 8 (no summary generated — the article's own excerpt is used as display text in the feed).

Update `articles.status = 'clustered'` for all articles.

### Step 8 — Summarisation

For each cluster with ≥ 2 articles, call Gemini:

```
You are a news curator. Given these {n} articles on a related AI topic, write:
1. A 2–3 sentence summary that explains what happened and why it matters.
   Surface expert perspectives, not just event facts.
2. The most relevant topic tag (one of: model-release, research, funding, product, policy, other).
3. Overall sentiment (positive / neutral / negative).
4. Up to 5 named entities (companies, people, models).

Output JSON:
{
  "summary": "...",
  "topicTag": "...",
  "sentiment": "...",
  "entities": ["..."]
}

Articles:
{for each article: title + excerpt}
```

- Model: `INGEST_MODEL` constant
- Write a `clusters` Firestore doc per cluster

### Step 9 — Return result

The `POST /api/ingest` handler returns:

```json
{
  "duration_ms": 12400,
  "sources": 8,
  "urls_found": 142,
  "too_old": 61,
  "new_articles": 34,
  "discarded": 12,
  "clustered": 18,
  "clusters_created": 7
}
```

---

## 6. Admin source management

### Access control

Admin is gated by an `ADMIN_EMAILS` env var (comma-separated list). The `app/admin` layout checks the current user's email against this list server-side; non-admins get a 403 page. No separate roles system — keep it simple.

```
ADMIN_EMAILS=you@example.com,colleague@example.com
```

### Source API (`app/api/sources/`)

```
GET  /api/sources           → { sources: Source[] }
POST /api/sources           body: { url, name? }
                            → auto-detects type from URL pattern:
                              contains /feed /rss /atom or ends in .xml → 'rss'
                              else → 'page'
                            → derives name from URL hostname if omitted
                            → returns created Source doc

PATCH /api/sources/[id]     body: { enabled?, name?, url? }
                            → partial update; returns updated doc

DELETE /api/sources/[id]    → removes doc; returns 204
```

All routes validate the requesting user is in `ADMIN_EMAILS`. Return 403 otherwise.

### Admin UI (`app/admin/sources/page.tsx`)

A single server-rendered page with client interactivity. Layout:

- **Header**: "Sources" title + "Add source" button (opens an inline form row at top of table)
- **Table columns**: Name · URL · Type badge · Enabled toggle · Delete button
- **Add form**: URL input (required) + Name input (optional, placeholder "auto-detected") + Save button
  - On save: `POST /api/sources`, row appended to table on success
- **Enabled toggle**: `<input type="checkbox">` — on change, `PATCH /api/sources/[id]` with `{ enabled }`. No confirmation needed.
- **Delete**: icon button — `DELETE /api/sources/[id]`. Show a confirmation popover before deleting.
- **Empty state**: "No sources yet. Add a URL above to get started."

Styling follows the existing Printing Press design system (zero border radius, Geist font, no dark mode).

---

## 7. Code style

- Follow existing patterns: no comments unless the WHY is non-obvious
- TypeScript strict mode, no `any`
- All Firestore writes use `@google-cloud/firestore` Admin SDK (same client as `lib/firebase.ts`)
- No additional wrappers or abstractions beyond what the task requires
- `lib/scrape.ts` extracts `fetchAndConvertToMarkdown` out of `lib/ai-utils.ts` — do not duplicate it; move it and re-export from `ai-utils.ts`
- All new env vars validated with Zod at the top of `lib/ingest.ts`

New env vars:

```
FIRECRAWL_API_KEY=          # optional; Firecrawl fallback scraping
ADMIN_EMAILS=               # comma-separated list of admin email addresses
INGEST_MODEL=               # optional; defaults to gemini-3.1-flash-lite
```

`INGEST_MODEL` is read once at the top of `lib/ingest.ts` and passed to every Gemini call in the pipeline (URL extraction, relevance scoring, summarisation). To switch models, change the env var — no code changes needed:

```typescript
const INGEST_MODEL = process.env.INGEST_MODEL ?? "gemini-3.1-flash-lite"
```

---

## 7. Testing strategy

No automated tests in this phase (no test runner configured).

Manual verification checklist:

- [ ] `/admin/sources` accessible only with an email in `ADMIN_EMAILS`; 403 for others
- [ ] Add a source URL via the UI → appears in Firestore `sources` collection
- [ ] Disabled sources are skipped by `POST /api/ingest`
- [ ] `POST /api/ingest` returns 200 with a stats JSON body including `too_old` count
- [ ] RSS items older than 3 days are not written to Firestore
- [ ] Running twice: second run reports `new_articles: 0` (dedup working)
- [ ] Firestore console shows `articles` docs with correct fields
- [ ] Firestore console shows `clusters` docs with non-empty summaries
- [ ] Articles with unrelated content get `status: 'discarded'`
- [ ] Logs show per-step progress (use `console.log` with step prefix)

---

## 8. Boundaries

### Always do

- Dedup every run — never write the same URL twice
- Cap RSS feeds at 20 articles per feed per run to limit cost
- Log each pipeline step with article counts
- Return the stats object even if some steps partially fail

### Ask before

- Adding any new npm dependencies beyond `rss-parser` and `firebase` (browser SDK for admin auth check)
- Changing the `news` collection schema (the existing read layer depends on it)
- Enabling the Firecrawl fallback path (requires API key and adds cost)

### Never do

- Store full article `bodyMd` longer than 50,000 characters (truncate with a note)
- Make concurrent requests to the same domain (add 500ms delay between same-domain fetches)
- Remove or rename existing `lib/ai-utils.ts` exports used by `app/api/summarize-single`

---

## 9. Open questions (not blocking Phase 1)

- **Feed integration**: ✅ Resolved — feed page reads from `clusters`. Multi-article clusters show an AI summary; singletons show the article excerpt. Each cluster card lists all source articles. `news` collection retired after verification.
- **Source management UI**: ✅ Resolved — Firestore-backed `sources` collection, managed via `/admin/sources`.
- **Singleton clusters**: ✅ Resolved — written as `clusters` docs with `isSingleton: true`, surfaced in the feed using the article's own excerpt.
- **Cost cap**: No per-run article cap yet. If sources return 500+ articles, Gemini scoring costs could spike. Add a `MAX_ARTICLES_PER_RUN` env var cap as a follow-up.

---

_Last updated: 2026-05-16_
