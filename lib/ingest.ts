import { GoogleGenAI } from "@google/genai"
import { FieldValue } from "@google-cloud/firestore"
import { JSDOM } from "jsdom"
import { db } from "@/lib/firebase"
import { sha256 } from "@/lib/hash"
import { fetchArticle, HttpError, assertSafeUrl } from "@/lib/scrape"
import { parseRssFeed } from "@/lib/rss"
import {
  embed,
  clusterWithExisting,
  toClusterArticle,
  type ArticleWithEmbedding,
  type ExistingCluster,
} from "@/lib/cluster"
import { getRecentClusterCentroids, updateCluster } from "@/lib/firebase"
import type { Source, TopicTag, Sentiment } from "@/lib/types"

const INGEST_MODEL = process.env.INGEST_MODEL ?? "gemini-3.1-flash-lite"
const THREE_DAYS_MS = 72 * 60 * 60 * 1000
const MAX_BODY_CHARS = 50_000
const DOMAIN_DELAY_MS = 500

const ai = new GoogleGenAI({
  enterprise: true,
  project: process.env.GOOGLE_CLOUD_PROJECT_ID,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? "global",
})

export interface IngestStats {
  duration_ms: number
  sources: number
  urls_found: number
  too_old: number
  new_articles: number
  discarded: number
  clustered: number
  clusters_created: number
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function hostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

async function findRssLink(html: string, baseUrl: string): Promise<string | null> {
  const doc = new JSDOM(html, { url: baseUrl })
  const link = doc.window.document.querySelector<HTMLLinkElement>(
    'link[rel="alternate"][type="application/rss+xml"], link[rel="alternate"][type="application/atom+xml"]'
  )
  if (!link?.href) return null
  try {
    return new URL(link.href, baseUrl).href
  } catch {
    return null
  }
}

async function extractUrlsWithLlm(markdown: string, baseUrl: string): Promise<string[]> {
  const today = new Date().toISOString().slice(0, 10)
  const prompt = `Extract article URLs published in the last 3 days from the following webpage content.
Today's date is ${today}.
Return only a JSON array of absolute URLs: ["https://...", ...]
If a URL is relative, resolve it against the base URL: ${baseUrl}
If a publication date is visible next to a link, exclude articles older than 3 days.
If no date is visible for an article, include it (date will be verified after fetching).
Ignore pagination, tag, category, and author links.

Content:
${markdown.slice(0, 8000)}`

  const response = await ai.models.generateContent({
    model: INGEST_MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  })

  try {
    const text = response.text ?? "[]"
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((u): u is string => typeof u === "string")
      .filter((u) => {
        try {
          const p = new URL(u)
          return p.protocol === "https:" || p.protocol === "http:"
        } catch {
          return false
        }
      })
  } catch {
    return []
  }
}

async function resolveSourceUrls(
  source: Source,
  log: (msg: string) => void
): Promise<{ url: string; pubDate: Date | null }[]> {
  if (source.type === "rss" || source.feedUrl) {
    const feedUrl = source.feedUrl ?? source.url
    log(`  RSS feed: ${feedUrl}`)
    return parseRssFeed(feedUrl)
  }

  // page source — try RSS autodiscovery first
  assertSafeUrl(source.url)
  log(`  Fetching page: ${source.url}`)
  const res = await fetch(source.url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  }).catch(() => null)

  if (!res || !res.ok) {
    const status = res?.status ?? "network error"
    if (process.env.FIRECRAWL_API_KEY) {
      log(`  Failed to fetch page (${status}) — trying Firecrawl`)
      const fc = await firecrawlFetch(source.url)
      if (fc) {
        const urls = await extractUrlsWithLlm(fc, source.url)
        log(`  LLM extracted ${urls.length} URLs via Firecrawl`)
        return urls.map((url) => ({ url, pubDate: null }))
      }
    }
    log(`  Failed to fetch page (${status})`)
    return []
  }

  const html = await res.text()
  const feedUrl = await findRssLink(html, source.url)

  if (feedUrl) {
    log(`  Discovered RSS: ${feedUrl}`)
    await db.collection("sources").doc(source.id).update({ feedUrl })
    return parseRssFeed(feedUrl)
  }

  log(`  No RSS found — using LLM to extract article URLs`)
  const { JSDOM: _JSDOM } = await import("jsdom")
  const { Readability } = await import("@mozilla/readability")
  const { default: TurndownService } = await import("turndown")
  const doc = new _JSDOM(html, { url: source.url })
  const article = new Readability(doc.window.document).parse()

  // Use markdown (converted from HTML) so links are preserved for the LLM
  const td = new TurndownService({ headingStyle: "atx" })
  let markdown = article?.content ? td.turndown(article.content) : ""

  if (markdown.length < 500 && process.env.FIRECRAWL_API_KEY) {
    log(`  Insufficient content from Readability — trying Firecrawl`)
    const fc = await firecrawlFetch(source.url)
    if (fc) markdown = fc
  }

  if (!markdown) return []

  const urls = await extractUrlsWithLlm(markdown, source.url)
  log(`  LLM extracted ${urls.length} URLs`)
  return urls.map((url) => ({ url, pubDate: null }))
}

// ─── main pipeline ─────────────────────────────────────────────────────────────

export async function runIngest(log: (msg: string) => void = console.log): Promise<IngestStats> {
  const start = Date.now()
  const stats: IngestStats = {
    duration_ms: 0,
    sources: 0,
    urls_found: 0,
    too_old: 0,
    new_articles: 0,
    discarded: 0,
    clustered: 0,
    clusters_created: 0,
  }

  // Step 1 — load enabled sources
  log("Step 1/8 — Loading sources")
  const sourcesSnap = await db.collection("sources").where("enabled", "==", true).get()
  const sources = sourcesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Source)
  stats.sources = sources.length
  if (sources.length === 0) {
    log("No enabled sources found. Stopping.")
    stats.duration_ms = Date.now() - start
    return stats
  }
  log(`Found ${sources.length} enabled source${sources.length === 1 ? "" : "s"}`)

  // Step 2 — resolve article URLs from each source
  log("Step 2/8 — Resolving article URLs")
  const cutoff = new Date(Date.now() - THREE_DAYS_MS)
  const allItems: { url: string; pubDate: Date | null }[] = []

  for (const source of sources) {
    log(`Source: ${source.name ?? source.url}`)
    try {
      const items = await resolveSourceUrls(source, log)
      let tooOld = 0
      for (const item of items) {
        if (item.pubDate && item.pubDate < cutoff) {
          tooOld++
          stats.too_old++
          continue
        }
        allItems.push(item)
      }
      log(`  ${items.length} items (${tooOld} too old, ${items.length - tooOld} kept)`)
    } catch (e) {
      log(`  Error: ${(e as Error).message}`)
    }
  }

  // deduplicate URLs across sources
  const seen = new Set<string>()
  const uniqueItems = allItems.filter(({ url }) => {
    if (seen.has(url)) return false
    seen.add(url)
    return true
  })

  stats.urls_found = uniqueItems.length
  log(`${stats.urls_found} unique URLs (${stats.too_old} filtered as too old)`)

  // Step 3 — dedup against Firestore
  log("Step 3/8 — Deduplicating against existing articles")
  const hashes = uniqueItems.map(({ url }) => sha256(url))
  const refs = hashes.map((h) => db.collection("articles").doc(h))
  const BATCH_SIZE = 500
  const snapBatches = await Promise.all(
    Array.from({ length: Math.ceil(refs.length / BATCH_SIZE) }, (_, i) =>
      db.getAll(...refs.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE))
    )
  )
  const snaps = snapBatches.flat()
  const newItems = uniqueItems.filter((_, i) => !snaps[i].exists)
  log(
    `${newItems.length} new URLs to scrape (${uniqueItems.length - newItems.length} already ingested)`
  )

  // Step 4 — scrape articles
  log("Step 4/8 — Scraping articles")
  const domainLastFetch: Record<string, number> = {}
  const rawArticleIds: string[] = []

  for (const { url, pubDate: feedPubDate } of newItems) {
    const domain = hostname(url)
    const last = domainLastFetch[domain]
    if (last && Date.now() - last < DOMAIN_DELAY_MS) {
      await sleep(DOMAIN_DELAY_MS - (Date.now() - last))
    }
    domainLastFetch[domain] = Date.now()

    const hash = sha256(url)

    try {
      log(`  Scraping: ${url}`)
      const scraped = await fetchArticle(url)

      // post-scrape date filter for page-sourced items (no feedPubDate)
      if (!feedPubDate && scraped.pubDate && scraped.pubDate < cutoff) {
        log(`  Too old: ${url}`)
        stats.too_old++
        continue
      }

      // Firecrawl fallback for JS-rendered pages (skip for Reddit — low count is expected for image posts)
      let bodyMd = scraped.markdown
      if (
        scraped.wordCount < 50 &&
        process.env.FIRECRAWL_API_KEY &&
        !hostname(url).includes("reddit.com")
      ) {
        log(`  Low word count — trying Firecrawl fallback`)
        const fc = await firecrawlFetch(url)
        if (fc) bodyMd = fc
      }

      if (!bodyMd) {
        log(`  No content extracted — marking as fetch_failed`)
        await writeFailedArticle(hash, url, domain)
        continue
      }

      const pubDate = feedPubDate ?? scraped.pubDate ?? null
      const id = await saveRawArticle({
        url,
        urlHash: hash,
        title: scraped.title,
        domain,
        bodyMd: bodyMd.slice(0, MAX_BODY_CHARS),
        excerpt: scraped.excerpt.slice(0, 500),
        pubDate,
      })
      rawArticleIds.push(id)
      stats.new_articles++
      log(`  Saved: "${scraped.title || url}"`)
    } catch (e) {
      if (e instanceof HttpError && (e.status === 403 || e.status === 429)) {
        log(`  HTTP ${e.status} — trying CloakBrowser fallback`)
        let fallbackMd = await cloakbrowserFetch(url)
        let fallbackSource = "CloakBrowser"

        if (!fallbackMd && process.env.FIRECRAWL_API_KEY) {
          log(`  CloakBrowser failed — trying Firecrawl fallback`)
          fallbackMd = await firecrawlFetch(url)
          fallbackSource = "Firecrawl"
        }

        if (fallbackMd) {
          const id = await saveRawArticle({
            url,
            urlHash: hash,
            title: "",
            domain,
            bodyMd: fallbackMd.slice(0, MAX_BODY_CHARS),
            excerpt: fallbackMd.slice(0, 500),
            pubDate: feedPubDate ?? null,
          })
          rawArticleIds.push(id)
          stats.new_articles++
          log(`  Saved via ${fallbackSource}: ${url}`)
        } else {
          log(`  All fallbacks failed — will retry next run: ${url}`)
        }
      } else if (e instanceof HttpError && e.status >= 500) {
        log(`  HTTP ${e.status} — will retry next run: ${url}`)
      } else if (e instanceof HttpError) {
        log(`  HTTP ${e.status} — marking as failed: ${url}`)
        await writeFailedArticle(hash, url, domain)
      } else {
        log(`  Error scraping ${url}: ${(e as Error).message}`)
        await writeFailedArticle(hash, url, domain)
      }
    }
  }

  log(`Scraped ${stats.new_articles} article${stats.new_articles === 1 ? "" : "s"}`)

  await runAiPipeline(rawArticleIds, stats, log)

  stats.duration_ms = Date.now() - start
  return stats
}

async function saveRawArticle(fields: {
  url: string
  urlHash: string
  title: string
  domain: string
  bodyMd: string
  excerpt: string
  pubDate: Date | null
}): Promise<string> {
  const { urlHash, ...rest } = fields
  await db
    .collection("articles")
    .doc(urlHash)
    .set({
      ...rest,
      relevanceScore: 0,
      embedding: [],
      status: "raw",
      ingestedAt: FieldValue.serverTimestamp(),
    })
  return urlHash
}

async function writeFailedArticle(urlHash: string, url: string, domain: string) {
  await db.collection("articles").doc(urlHash).set({
    url,
    title: "",
    domain,
    bodyMd: "",
    excerpt: "",
    relevanceScore: 0,
    embedding: [],
    status: "fetch_failed",
    ingestedAt: FieldValue.serverTimestamp(),
  })
}

async function cloakbrowserFetch(url: string): Promise<string | null> {
  try {
    const { launch } = await import("cloakbrowser")
    const { Readability } = await import("@mozilla/readability")
    const { JSDOM, VirtualConsole } = await import("jsdom")
    const { default: TurndownService } = await import("turndown")

    const browser = await launch({ headless: true })
    let html: string
    try {
      const page = await browser.newPage()
      await page.goto(url, { waitUntil: "domcontentloaded" })
      html = await page.content()
    } finally {
      await browser.close()
    }

    const virtualConsole = new VirtualConsole()
    let doc: JSDOM
    try {
      doc = new JSDOM(html, { url, virtualConsole })
    } catch {
      doc = new JSDOM(html, { virtualConsole })
    }

    const article = new Readability(doc.window.document).parse()
    if (!article?.content) return null

    const td = new TurndownService({ headingStyle: "atx" })
    return `# ${article.title}\n\n${td.turndown(article.content)}`
  } catch {
    return null
  }
}

async function firecrawlFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({ url, formats: ["markdown"] }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data?.markdown ?? null
  } catch {
    return null
  }
}

// ─── AI pipeline (steps 5–9) ──────────────────────────────────────────────────

async function runAiPipeline(articleIds: string[], stats: IngestStats, log: (msg: string) => void) {
  // Pick up stuck articles from previous failed runs
  const [stuckRawSnap, stuckScoredSnap] = await Promise.all([
    db.collection("articles").where("status", "==", "raw").get(),
    db.collection("articles").where("status", "==", "scored").get(),
  ])

  const stuckRawIds = stuckRawSnap.docs.map((d) => d.id).filter((id) => !articleIds.includes(id))

  const allRawIds = [...articleIds, ...stuckRawIds]
  const stuckScoredIds = stuckScoredSnap.docs.map((d) => d.id)

  if (stuckRawIds.length > 0)
    log(`Recovered ${stuckRawIds.length} stuck raw article(s) from previous runs`)
  if (stuckScoredIds.length > 0)
    log(`Recovered ${stuckScoredIds.length} stuck scored article(s) from previous runs`)

  if (allRawIds.length === 0 && stuckScoredIds.length === 0) {
    log("No articles to process through AI pipeline")
    return
  }

  // Step 5 — relevance scoring in batches of 10
  log("Step 5/8 — Scoring relevance")
  const BATCH = 10
  const scoredIds: string[] = [...stuckScoredIds]

  for (let i = 0; i < allRawIds.length; i += BATCH) {
    const batch = allRawIds.slice(i, i + BATCH)
    const docs = await Promise.all(batch.map((id) => db.collection("articles").doc(id).get()))

    for (const doc of docs) {
      if (!doc.exists) continue
      const data = doc.data()!
      const score = await scoreRelevance(data.title, data.excerpt)
      if (score === null) {
        log(`  Score failed for "${data.title}" — left as raw, will retry next ingestion`)
      } else if (score < 5) {
        await doc.ref.update({ status: "discarded", relevanceScore: score })
        stats.discarded++
        log(`  Discarded (score ${score}/10): "${data.title}"`)
      } else {
        await doc.ref.update({ status: "scored", relevanceScore: score })
        scoredIds.push(doc.id)
        log(`  Relevant (score ${score}/10): "${data.title}"`)
      }
    }
  }
  log(`Scoring done: ${scoredIds.length} relevant, ${stats.discarded} discarded`)

  // Step 6 — embeddings
  log("Step 6/8 — Generating embeddings")
  const articlesWithEmbedding: ArticleWithEmbedding[] = []

  for (const id of scoredIds) {
    const doc = await db.collection("articles").doc(id).get()
    if (!doc.exists) continue
    const data = doc.data()!
    try {
      const embedding = await embed(`${data.title}\n\n${data.excerpt}`)
      await doc.ref.update({ embedding })
      articlesWithEmbedding.push({
        id,
        title: data.title,
        url: data.url,
        domain: data.domain,
        excerpt: data.excerpt,
        relevanceScore: data.relevanceScore,
        embedding,
        pubDate: data.pubDate?.toDate?.() ?? null,
      })
      log(`  Embedded: "${data.title}"`)
    } catch (e) {
      log(`  Embedding failed for "${data.title}": ${(e as Error).message}`)
    }
  }
  log(`Embedded ${articlesWithEmbedding.length} articles`)

  // Step 7 — cluster (cross-run: check new articles against recent existing clusters first)
  log("Step 7/8 — Clustering")
  const recentClusters = await getRecentClusterCentroids(3)
  log(`Loaded ${recentClusters.length} recent cluster centroids`)

  const existingForClustering: ExistingCluster[] = recentClusters.map((c) => ({
    id: c.id,
    centroid: c.centroid,
    articles: c.articles.map((a) => ({
      ...a,
      embedding: [],
    })),
  }))

  const newArticleIds = new Set(articlesWithEmbedding.map((a) => a.id))

  const { newClusters, updatedClusters } = clusterWithExisting(
    articlesWithEmbedding,
    existingForClustering
  )

  stats.clustered = articlesWithEmbedding.length
  stats.clusters_created = newClusters.length
  const singletons = newClusters.filter((c) => c.isSingleton).length
  log(
    `${newClusters.length} new clusters (${singletons} singletons), ${updatedClusters.length} existing clusters updated`
  )

  // Step 8 — summarise new clusters and update existing ones
  log("Step 8/8 — Summarising and writing clusters")

  // Update existing clusters that gained new articles
  for (const updated of updatedClusters) {
    const allArticles = updated.articles.map(toClusterArticle)
    await updateCluster(updated.id, allArticles, updated.centroid)
    await Promise.all(
      updated.articles
        .filter((a) => newArticleIds.has(a.id))
        .map((a) => db.collection("articles").doc(a.id).update({ status: "clustered" }))
    )
    log(`  Updated existing cluster with ${updated.articles.length} total articles`)
  }

  // Write new clusters
  for (const cluster of newClusters) {
    const clusterArticlesData = cluster.articles.map(toClusterArticle)

    let summary = clusterArticlesData[0].excerpt
    let topicTag: TopicTag = "other"
    let sentiment: Sentiment = "neutral"
    let entities: string[] = []

    if (!cluster.isSingleton) {
      log(
        `  Summarising cluster: "${cluster.articles[0].title}" + ${cluster.articles.length - 1} more`
      )
      const result = await summariseCluster(cluster.articles)
      summary = result.summary
      topicTag = result.topicTag
      sentiment = result.sentiment
      entities = result.entities
    }

    const publishedAt = cluster.articles.find((a) => a.pubDate)?.pubDate ?? new Date()

    await db.collection("clusters").add({
      summary,
      topicTag,
      sentiment,
      entities,
      isSingleton: cluster.isSingleton,
      articles: clusterArticlesData,
      centroid: cluster.centroid,
      articleCount: cluster.articles.length,
      publishedAt,
      createdAt: FieldValue.serverTimestamp(),
    })

    await Promise.all(
      cluster.articles.map((a) =>
        db.collection("articles").doc(a.id).update({ status: "clustered" })
      )
    )
  }
  log(
    `Written ${newClusters.length} new cluster${newClusters.length === 1 ? "" : "s"}, updated ${updatedClusters.length} existing`
  )
}

async function scoreRelevance(title: string, excerpt: string): Promise<number | null> {
  const prompt = `Score the relevance of this article to the topic of AI/machine learning (0–10).
Output only a JSON object: { "score": <number> }
Article title: ${title}
Excerpt: ${excerpt}`

  try {
    const response = await ai.models.generateContent({
      model: INGEST_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    })
    const parsed = JSON.parse(response.text ?? '{"score":0}')
    const score = Number(parsed.score)
    return isNaN(score) ? 0 : Math.min(10, Math.max(0, score))
  } catch {
    return null
  }
}

interface SummaryResult {
  summary: string
  topicTag: TopicTag
  sentiment: Sentiment
  entities: string[]
}

async function summariseCluster(articles: ArticleWithEmbedding[]): Promise<SummaryResult> {
  const articleList = articles.map((a, i) => `${i + 1}. ${a.title}\n${a.excerpt}`).join("\n\n")

  const prompt = `You are a news curator. Given these ${articles.length} articles on a related AI topic, write:
1. A 2–3 sentence summary that explains what happened and why it matters. Surface expert perspectives, not just event facts.
2. The most relevant topic tag (one of: model-release, research, funding, product, policy, industry, agents, hardware, opinion, education, other).
   - model-release: new model or major version announcement
   - research: papers, benchmarks, academic findings
   - funding: fundraising, acquisitions, IPOs, investments
   - product: product launches, features, integrations, apps
   - policy: regulation, legislation, government, safety standards
   - industry: company strategy, exec moves, partnerships, org news
   - agents: AI agents, agentic frameworks, autonomous systems
   - hardware: chips, infrastructure, edge devices, robotics
   - opinion: essays, commentary, hot takes, analysis pieces
   - education: tutorials, courses, guides, explainers
   - other: does not fit any of the above
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
${articleList}`

  try {
    const response = await ai.models.generateContent({
      model: INGEST_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    })
    const parsed = JSON.parse(response.text ?? "{}")
    return {
      summary: parsed.summary ?? articles[0].excerpt,
      topicTag: (parsed.topicTag as TopicTag) ?? "other",
      sentiment: (parsed.sentiment as Sentiment) ?? "neutral",
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
    }
  } catch {
    return {
      summary: articles[0].excerpt,
      topicTag: "other",
      sentiment: "neutral",
      entities: [],
    }
  }
}
