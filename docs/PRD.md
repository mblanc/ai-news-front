# Pulse — Product Requirements Document

> Status: Draft v1.0 · May 2026  
> Author: —  
> Stack reference: PULSE_TECHSTACK.md

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Target Users](#3-target-users)
4. [Goals & Success Metrics](#4-goals--success-metrics)
5. [User Stories](#5-user-stories)
6. [Feature Requirements](#6-feature-requirements)
7. [Information Architecture](#7-information-architecture)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Out of Scope](#9-out-of-scope)
10. [Dependencies & Risks](#10-dependencies--risks)
11. [Phased Roadmap](#11-phased-roadmap)
12. [Open Questions](#12-open-questions)

---

## 1. Executive Summary

Pulse is an AI-powered news aggregation and curation SaaS. It autonomously ingests content on any topic from a curated set of websites, RSS feeds, and social platforms (Reddit, X, TikTok, Instagram), processes it into deduplicated, semantically clustered digests, and exposes a persistent read layer that any subscriber can query at any time across four temporal windows: today, this week, this month, and this year.

The product is domain-agnostic: a user can follow "LLM Research" and "EU Energy Policy" side by side. Pulse owns the curated source library — including expert opinion sources, analyst blogs, and domain-specific publications alongside mainstream outlets — and is responsible for ensuring that high-value qualitative content (expert takes, nuanced analysis, canonical pieces) is surfaced, not just news headlines. Users subscribe to topics rather than to sources. A single pipeline runs per curated topic regardless of subscriber count, keeping marginal cost near zero as the user base scales. Beyond the curated library, Starter+ users can create their own topics in two ways: by describing what they want in natural language, or by pasting a list of URLs (RSS feeds, websites, Reddit communities, X accounts). Pulse parses the intent or the URLs, auto-configures the pipeline, and starts delivering within minutes.

Pulse is sold as a SaaS with four tiers (Free, Starter, Pro, Team), with delivery options spanning a web app, RSS feeds, email digests, Obsidian vault sync, Slack/Teams webhooks, and a REST API.

---

## 2. Problem Statement

### The signal-to-noise problem

Any fast-moving domain produces hundreds of meaningful pieces of content per day across fragmented sources: research papers, funding announcements, practitioner threads, product launches, video commentary. No single source covers it all. Staying informed requires active monitoring of dozens of feeds, which is time-consuming and inconsistent — most professionals either over-invest in curation or under-invest and miss important developments.

### The qualitative signal problem

The highest-value content in any domain is not the news headline — it is the expert take, the nuanced analysis piece, the canonical article that puts an event in context. This content is scattered across substacks, personal blogs, niche publications, and long-form threads that most users do not have time to monitor systematically. Mainstream RSS and news aggregators surface what is popular, not what is insightful. The result: users stay informed on surface facts while missing the perspectives that would actually change how they think.

### The deduplication problem

The same event generates dozens of derivative articles, threads, and reposts within hours. A reader following 10 sources may encounter the same story 15 times, with diminishing informational value per encounter.

### The recency-vs-depth tension

Current solutions optimise for one or the other: live feeds (Twitter, RSS readers) are noisy and lack synthesis; weekly newsletters are curated but delayed and lack interactivity. Neither gives a user the ability to ask "what happened this month?" and get a clean, structured answer in under two minutes.

### What Pulse solves

Pulse runs the curation and synthesis on a schedule, writes the output to a persistent store, and lets users read it at any granularity on their own time. The AI does the monitoring; the user gets the insight. Critically, Pulse's curated source libraries are built to surface expert opinions and analysis — not just mainstream coverage — so users get depth, not just breadth.

### The niche coverage gap

Even a comprehensive curated topic library cannot anticipate every user's specific professional context. These needs are too narrow for a shared curated topic but too important to the individual to go uncovered. The custom topic feature closes this gap: users bring their own framing — in plain language or as a list of sources — and Pulse builds the pipeline around it automatically.

---

## 3. Target Users

### Primary: The AI-adjacent professional

**Who:** Product managers, engineers, investors, researchers, founders, and consultants who need to stay current on AI developments as part of their job, but whose primary work is not AI research itself.

**Behaviour:** Checks the news once or twice a day, values synthesis over raw feeds, needs to be able to quickly brief a colleague or manager on "what happened this week in AI."

**Pain point:** Spends 20–40 minutes/day across Twitter, newsletters, and RSS readers to maintain situational awareness. Misses things. Gets duplicates. Has no structured way to go back and review a past week or month.

### Secondary: The AI researcher / practitioner

**Who:** ML engineers, AI safety researchers, academics, and technical leads at AI companies.

**Behaviour:** Needs topic-specific depth (e.g. "only LLM alignment research" or "only EU AI regulation"), consumes via API or RSS, integrates into a personal knowledge management system (Obsidian, Notion, Roam).

**Pain point:** Generic AI newsletters are too broad. arXiv alerts are too narrow. Wants a middle layer that aggregates signal across sources and surfaces it in a format compatible with their existing PKM workflow.

### Tertiary: The team / organisation

**Who:** AI teams at companies (e.g. an AI product team that wants everyone on the same page about the competitive landscape), innovation teams, consulting firms.

**Behaviour:** Wants a shared digest delivered to Slack or Teams, customised to a specific competitive domain. May need SAML SSO and shared topic libraries.

**Pain point:** Everyone on the team has a different view of what happened. Expensive to have someone curate manually. Existing tools (Feedly Teams, newsletters) lack semantic synthesis.

---

## 4. Goals & Success Metrics

### Business goals

| Goal       | Metric                                            | Target (12 months) |
| ---------- | ------------------------------------------------- | ------------------ |
| Revenue    | MRR                                               | $15K               |
| Activation | % of signups who subscribe to ≥1 topic within 24h | > 60%              |
| Retention  | Monthly active users / registered users           | > 40%              |
| Conversion | Free → paid conversion rate                       | > 8%               |
| Payback    | Months to recover CAC                             | < 6 months         |

### Product goals

| Goal           | Metric                                                         | Target         |
| -------------- | -------------------------------------------------------------- | -------------- |
| Speed to value | Time from signup to first digest view                          | < 3 minutes    |
| Digest quality | User-rated relevance score (thumbs up/down on clusters)        | > 80% positive |
| Coverage       | Clusters created per topic per day (hourly cadence topics)     | 5–20           |
| Deduplication  | % of duplicate articles correctly suppressed                   | > 90%          |
| Reliability    | Pipeline success rate (tasks completing without error)         | > 99%          |
| Latency        | P95 time from article publication to cluster appearing in feed | < 90 minutes   |

### Anti-goals

Pulse is not trying to be a reading app (no full article rendering), a social platform (no comments, replies, or social graph), or a search engine (no arbitrary keyword search across all sources globally).

---

## 5. User Stories

### Discovery & onboarding

- As a new user, I want to sign in with Google in one click so I don't have to create a password.
- As a new user, I want to see what topics are available before I commit to subscribing.
- As a new user, I want to see a sample digest for a topic before subscribing, so I can evaluate signal quality.
- As a new user, I want to subscribe to my first topic in under 60 seconds so I can start getting value immediately.

### Core read experience

- As a subscriber, I want to open Pulse and see today's top AI news, grouped by theme, so I can stay current in under 5 minutes.
- As a subscriber, I want to switch between today / this week / this month / this year views so I can choose the right level of breadth.
- As a subscriber, I want a single "briefing" view that gives me exactly one cluster per topic so I can get the two-minute version.
- As a subscriber, I want to filter my feed by topic tag (model release, funding, research, product, policy) so I can focus on what's relevant to me.
- As a subscriber, I want to bookmark a cluster so I can come back to it later.
- As a subscriber, I want to mark a cluster as read so it stops appearing as new.

### Topic management

- As a subscriber, I want to subscribe to multiple topics so I can cover different areas of interest in one place.
- As a subscriber, I want to unsubscribe from a topic without losing my other subscriptions.
- As a Starter+ user, I want to see the cadence and source list for any topic so I know how fresh and broad its coverage is.

### Custom topic creation — natural language

- As a Starter+ user, I want to describe what I want to follow in plain language so I don't have to think about keywords or sources.
- As a Starter+ user, I want to see what keywords and sources the system extracted from my description before it starts running, so I can correct any misunderstanding.
- As a Starter+ user, I want to edit the extracted keywords (add, remove, rename) before confirming the topic.
- As a Starter+ user, I want to see an estimated article volume per day before I confirm, so I know whether the topic is too broad or too narrow.
- As a Starter+ user, I want to run a "preview" that shows me the first 10 clusters from the last 7 days before committing to a topic, so I can validate relevance without waiting for a live run.

### Custom topic creation — URL list

- As a Starter+ user, I want to paste a list of URLs (RSS feeds, websites, subreddits, X accounts) and have Pulse auto-detect the type of each source so I don't have to configure anything manually.
- As a Starter+ user, I want to see which URLs were recognised as valid sources and which were not, before confirming, so I can fix bad URLs.
- As a Starter+ user, I want to add a plain-language description on top of my URL list so the relevance filter understands my intent even when the sources cover more than I want.
- As a Starter+ user, I want to name my topic and start the pipeline with one click after reviewing the source list.

### Custom topic management

- As a Starter+ user, I want to edit my custom topic's name, keywords, and source list after creation so I can refine it based on what I see in the feed.
- As a Starter+ user, I want to pause a custom topic without deleting it, so I can temporarily stop ingestion without losing my configuration.
- As a Starter+ user, I want to delete a custom topic and all associated data.
- As a Pro user, I want to share a custom topic with my team so everyone benefits from my configuration work.
- As a user, I want to see a warning when I'm approaching my custom topic limit so I can decide whether to upgrade or delete an old topic.

### Delivery preferences

- As a subscriber, I want to receive a daily email digest so I can read my briefing in my inbox without opening another app.
- As a subscriber, I want an RSS feed for each topic so I can subscribe in NetNewsWire, Feedly, or any RSS reader.
- As a Pro user, I want a Slack webhook so my team receives the morning brief directly in a channel.
- As a Pro user, I want my daily digest written to my Obsidian vault automatically so it integrates with my PKM.

### API (Pro/Team)

- As a developer, I want a REST API key so I can build my own integrations on top of Pulse data.
- As a developer, I want to query `/api/v1/feed?topic=llm-research&period=week` and get structured JSON so I can render clusters in my own interface.
- As a developer, I want to search clusters by semantic similarity so I can find related content programmatically.

### Account & billing

- As a user, I want to upgrade my plan in-app with a credit card so I can unlock more topics and features immediately.
- As a user, I want to see my current plan limits (topics used / allowed, API calls this month) so I know when I'm approaching a cap.
- As a Team admin, I want to invite team members and set shared topics so everyone has the same baseline.
- As a user, I want to rotate my API key from settings so I can revoke access if it's compromised.

### Security & trust

- As a user, I want to enable TOTP MFA so my account is protected even if my email is compromised.
- As a Team user, I want to sign in with my company SSO (SAML) so I don't need a separate Pulse password.
- As a user, I want to delete my account and all associated data so I can leave the platform cleanly.

---

## 6. Feature Requirements

### P0 — Launch blockers (Phase 1)

These are the minimum set for a usable v1.

**Ingestion**

- Scheduled ingestion from a curated list of RSS/web sources on a configurable cadence (minimum: 2h for Free, 1h for paid).
- Deduplication by URL hash: no article ingested twice for the same topic.
- Relevance scoring: articles below threshold (< 5/10) are discarded before processing.
- Embedding and greedy cosine clustering at threshold 0.82.
- Claude Sonnet summarisation per cluster: summary with attribution and perspective (who is saying what and why it matters, not just what happened), topic tag, sentiment, entities. Generic event-only summaries are a quality failure. The prompt must explicitly surface expert viewpoints and significance, not just restate the headline.

**Topic system**

- A starting library of ≥ 10 curated topics. Initial validation topics cover the AI domain (LLM research, AI agents, AI funding, AI policy, model releases, AI products, AI safety, robotics, AI infrastructure, applied AI); the pipeline is domain-agnostic and not limited to AI.
- Each topic has: name, slug, description, keyword list, source list, cadence.
- Source lists must include expert opinion sources (domain-specific substacks, researcher blogs, analyst publications) alongside mainstream outlets. Source curation quality is a core product responsibility.

**Read layer — web app**

- Authenticated feed page with four period tabs: Today, Week, Month, Year.
- Topic filter sidebar (by topic tag).
- Cluster card: summary, entities, tag badge, sentiment indicator, timestamp.
- Mark-as-read on hover (client-side Firestore write).
- Bookmark toggle.
- Overview / briefing page: one cluster per subscribed topic, today.
- Responsive layout (mobile-first).

**Auth**

- Google OAuth sign-in.
- Passwordless magic link.
- Session cookies via Identity Platform (`createSessionCookie`).
- Automatic Firestore profile provisioning on first sign-in (`beforeCreate` blocking function).

**Infrastructure**

- Cloud Run monolith (single service).
- Cloud Tasks pipeline: ingest → process → fanout chain.
- Cloud Scheduler: hourly and daily triggers.
- Firestore with Security Rules and pgvector-equivalent KNN via `findNearest()`.
- Identity Platform with blocking functions.
- Secret Manager for all credentials.
- Cloud Build CI/CD: typecheck + lint + test + build + deploy in one pipeline.

---

### P1 — Fast follow (Phase 2)

**Social ingestion**

- Reddit ingestion via ScrapeCreators (r/MachineLearning, r/artificial, r/singularity, r/ArtificialIntelligence, score-filtered by hot).
- X ingestion via ScrapeCreators (keyword search: AI researchers, model release terms, trending hashtags).
- Configurable per-topic source selection (which social platforms to include).

**Email digest**

- Daily email digest via Resend: personalised per-user, top 5 clusters per subscribed topic, sent at 07:30 local time.
- Unsubscribe link in every email (one-click, no login required).
- Plain-text fallback.

**Custom topic creation**

Users can create their own private topics via two modes. Both modes run through the same underlying pipeline — the difference is how the topic configuration (keywords + source list) is produced.

_Mode A — Natural language:_

- User writes a plain-language description of what they want to follow (e.g. "open-source AI models, fine-tuning techniques, Hugging Face releases").
- A Claude Haiku call extracts: suggested topic name, keyword list (3–10 terms), and a recommended source set drawn from the master source registry.
- User is shown a preview card: editable keyword chips, toggleable source checkboxes, estimated articles/day.
- User can optionally run a 7-day dry-run preview (queries Exa AI retroactively; no pipeline cost until confirmed).
- On confirmation, topic is created with `isUserCreated: true`, `createdBy: userId`, `visibility: 'private'`.

_Mode B — URL list:_

- User pastes URLs one per line (any mix of RSS feeds, websites, subreddits, X accounts).
- System auto-detects source type per URL using a heuristic classifier:
  - Path contains `/feed`, `/rss`, `/atom`, or ends in `.xml` → `rss`
  - `reddit.com/r/…` → `reddit`
  - `x.com/…` or `twitter.com/…` → `x`
  - All other URLs → `scrape` (via Firecrawl)
- System validates each URL (HEAD request; marks invalid URLs with an error state).
- User names the topic, optionally adds a plain-language relevance filter, and confirms.
- On confirmation, new sources not already in the master registry are provisioned; topic is created.

_Shared constraints (both modes):_

- Custom topics count against the user's topic allowance (same as curated subscriptions).
- Hard cap: 500 articles/day per custom topic to prevent runaway API costs.
- Custom topics are `private` by default; not visible to other users.
- Plan limits: Free = 0 custom topics; Starter = 1; Pro = 5; Team = unlimited.
- Editing (keywords, sources, name, cadence) available after creation via a topic settings page.
- Pause and delete controls available.

**Topic request queue (deprecated in favour of self-serve)**

The manual topic request queue from the original P1 is replaced by self-serve custom topic creation. Curated topic additions are still managed internally but no longer require a user-facing request flow.

**Plan limits UI**

- Settings page showing: plan tier, topics used / allowed (curated + custom combined), next renewal date, API calls this month (Pro/Team).
- Upgrade CTA when approaching limits.

---

### P2 — Growth features (Phase 3)

**TikTok + Instagram ingestion**

- TikTok keyword/hashtag search via ScrapeCreators.
- Instagram hashtag search via ScrapeCreators.
- Both are lower cadence (every 4h) due to noisier signal.

**Obsidian sync**

- Nightly Cloud Scheduler job generates a `YYYY-MM-DD.md` file per subscribed user.
- YAML frontmatter: `tags: [pulse, ai-news]`, `date`, `source`.
- Delivered to `gs://pulse-prod-exports/obsidian/{userId}/` with a 7-day signed URL stored on the user profile.
- Settings page shows latest sync time and the signed URL for Obsidian plugin configuration.

**Webhooks (Slack / Teams)**

- Pro users can configure up to 3 webhook URLs.
- Payloads sent after each fanout: top clusters for the time window since last post.
- Morning brief (08:00) and evening brief (17:00) delivery modes.
- Slack Block Kit format; Teams Adaptive Card format.

**REST API**

- `GET /api/v1/feed` — paginated cluster list, filter by topic/period/tag.
- `GET /api/v1/topics` — list available topics.
- `POST /api/v1/topics/subscribe` — subscribe/unsubscribe.
- `GET /api/v1/search?q=` — semantic KNN cluster search via Firestore `findNearest()`.
- Key-based auth (`Authorization: Bearer {apiKey}`).
- Rate limits: 20 req/min (Starter), 100 req/min (Pro), 500 req/min (Team).

**MFA**

- TOTP (authenticator app) enrolment for Starter+ users.
- MFA status visible in settings.
- Recovery codes generated on enrolment.

---

### P3 — Scale features (Phase 4)

**Team plan**

- Team workspace: shared topic library, shared delivery settings.
- Member invite by email (up to 25 seats).
- Admin role: can add/remove topics and members.
- SAML/OIDC SSO via Identity Platform multi-tenancy.
- Shared Slack integration (one webhook, all team members).

**Custom topic sharing (Team plan)**

- Team admins can promote a private custom topic to `visibility: 'shared'`, making it available to all workspace members.
- Shared custom topics appear in the team's topic library alongside curated topics.
- Sharing a topic does not duplicate the pipeline — all workspace members subscribe to the same topic pipeline.

**Custom topic import/export**

- Pro users can export a custom topic configuration as a JSON file (name, keywords, source URLs).
- Import: paste or upload a JSON file to create a topic from someone else's configuration.
- This enables informal sharing (e.g. a community posting a `pulse-topic.json` on GitHub) without a marketplace.

**Digest history**

- Users can browse past digests by date ("What happened on 14 May 2026?").
- Calendar picker in the feed UI.
- Deep-link to specific cluster (`/feed?cluster={id}`).

**Cluster feedback**

- Thumbs up / thumbs down on each cluster.
- Feedback written to Firestore; aggregated nightly.
- Used to surface quality regressions (< 70% positive on a topic → alert).
- Long-term: use as preference signal for RLHF-style reranking.

**Topic discovery**

- Trending topics page: topics with the highest cluster volume growth in the last 7 days.
- "Topics you might like" recommendation on onboarding (based on subscribed topics + collaborative filtering).

---

## 7. Information Architecture

```
/ (marketing)
├── /pricing
├── /blog
└── /login

/feed (authenticated default)
├── /feed/day          ← default
├── /feed/week
├── /feed/month
├── /feed/year
└── /feed/overview     ← briefing mode (1 cluster per topic)

/topics
├── /topics/[slug]     ← curated topic detail + subscribe/unsubscribe
└── /topics/new        ← custom topic creation wizard (Starter+)
    ├── ?mode=natural  ← natural language mode (default)
    └── ?mode=urls     ← URL list mode

/topics/[topicId]/settings   ← edit custom topic (creator only)
    ← name, keywords, sources, cadence, pause/delete

/settings
├── /settings/plan     ← upgrade, billing, usage (includes custom topic count)
├── /settings/delivery ← email, RSS, webhooks, Obsidian
├── /settings/security ← MFA, API key, password
└── /settings/team     ← Team plan only: members, SSO, shared topics

/api/v1               ← public REST API (Pro+)
/api/tasks/*          ← Cloud Tasks endpoints (internal)
/api/schedule/*       ← Cloud Scheduler endpoints (internal)
/api/webhooks/stripe  ← Stripe webhook (internal)
/api/auth/session     ← session cookie management (internal)
```

### Navigation

Primary nav (authenticated): Feed · Topics · Settings  
Feed tab bar: Today · Week · Month · Year · Overview  
Feed sidebar: topic tag filter (All · Model Release · Funding · Research · Product · Policy)

Topics page: two tabs — **Curated** (browse + subscribe) · **My Topics** (custom topics, create new CTA)

---

## 8. Non-Functional Requirements

### Performance

- Web app: LCP < 2.5s on 4G mobile (Lighthouse target ≥ 90).
- Feed page: first cluster visible within 1s on repeat visits (Firestore `onSnapshot` with offline persistence).
- API: P95 latency < 300ms for `/api/v1/feed`.
- Pipeline: P95 latency from article publication to cluster in feed < 90 minutes (hourly topics).

### Reliability

- Cloud Run: target 99.9% uptime (GCP SLA).
- Pipeline: Cloud Tasks retry with exponential backoff; DLQ for tasks exhausting retries; alert on DLQ depth > 0.
- Firestore: point-in-time recovery enabled; daily automated backup to GCS.

### Security

- All user data in Firestore protected by Security Rules. Writes that would change `planTier`, `stripeCustomerId`, or `apiKey` are rejected client-side (only Admin SDK in task handlers can write these fields).
- All secrets in Secret Manager; never in source code or container images.
- Task handler routes (`/api/tasks/*`, `/api/schedule/*`) validated via OIDC token from Cloud Tasks / Cloud Scheduler service accounts. Requests without a valid OIDC token return 401.
- Stripe webhook validated via `stripe.webhooks.constructEvent()` signature check.
- HTTPS only; HSTS enforced.
- Cloud Armor: rate-limit 100 req/min/IP on `/api/*`.

### Privacy & compliance

- GDPR: right to erasure implemented (account deletion clears all Firestore subcollections and GCS objects for the user; queued within 30 days).
- Data residency: Firestore in `us-central1`; users in EU should be notified (no EU-region option in v1).
- Emails: every digest email has a one-click unsubscribe link; unsubscribe is processed immediately (no 10-day delay).

### Accessibility

- WCAG 2.1 AA compliance for the web app.
- Keyboard-navigable feed (Tab, Enter to open cluster detail, Escape to close).
- Sufficient colour contrast for all tag badges.
- All interactive elements have ARIA labels.

### Internationalisation

- v1: English only.
- All user-facing copy in a single `en.json` locale file; i18n infrastructure in place for future languages.

---

## 9. Out of Scope

The following are explicitly not part of Pulse v1 or v2 and should be treated as future bets, not implicit commitments:

- **Full article rendering** — Pulse shows cluster summaries and links out. It does not render full articles. It is not an RSS reader.
- **User-generated content** — no comments, annotations, replies, or social graph.
- **Video content ingestion** — TikTok and Instagram are ingested at the metadata/caption level only. No video transcription or playback.
- **Image/chart extraction** — articles are processed as text only. No visual content analysis.
- **Real-time push notifications** — no browser push notifications or mobile push in v1. Email digest and `onSnapshot` live feed are the real-time channels.
- **Mobile apps** — native iOS/Android apps are post-v2. The web app is mobile-responsive.
- **Public topic marketplace** — custom topics are private (or team-shared on Team plan). There is no public directory of user-created topics, no upvoting, no forking. Import/export via JSON is the informal sharing mechanism.
- **Third-party LLM providers** — Claude via Vertex AI is the only LLM. No model selection, no user-configurable summarisation prompts.
- **Competitor monitoring / entity tracking** — Pulse monitors topics, not specific companies or people. Custom topics can be narrow but are still thematic, not entity-centric (e.g. "Anthropic releases" is technically possible but not a supported use case pattern in v1).
- **Authenticated source ingestion** — custom topic URL lists must be publicly accessible. Pulse does not support authenticated RSS feeds, paywalled sites, or private Slack/Discord channels.

---

## 10. Dependencies & Risks

### External dependencies

| Dependency         | Risk level                                     | Mitigation                                                                                     |
| ------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| ScrapeCreators API | Medium — small team, single founder            | Maintain fallback adapter for direct Reddit API (free) as a hedge; TikHub as backup for social |
| Firecrawl          | Low — well-funded, growing                     | Most sites have RSS; Firecrawl is only needed for JS-rendered scrape targets                   |
| Exa AI             | Low                                            | Brave Search API as fallback; free tier covers early volume                                    |
| Claude via Vertex  | Low — GCP-native, Anthropic/Google partnership | No planned fallback; monitor for outages                                                       |
| Resend             | Low                                            | Postmark or SendGrid as drop-in alternatives                                                   |
| Stripe             | Very low                                       | No credible alternative needed                                                                 |

### Technical risks

**Firestore read cost at scale.** At high user counts, the fanout step writes one `userFeeds/{uid}/items/{clusterId}` document per user per cluster. At 5,000 users × 20 clusters/day × 30 days = 3M writes/month = $5.40. Manageable. But read costs for feed queries with many users could grow non-linearly if not cached. Mitigation: Firestore offline persistence + `onSnapshot` caching suppresses most re-reads.

**LLM cost spikes.** A misconfigured topic with very broad keywords could ingest thousands of articles, triggering proportionally large Claude Haiku relevance scoring calls. Mitigation: per-topic daily article cap (configurable, default 500); alert on LLM cost > $20/day.

**Social platform API access.** X, TikTok, and Instagram have historically restricted third-party access. ScrapeCreators scrapes at the network level, which is a ToS grey area. Mitigation: social sources are additive, not critical — the product works without them. RSS and Exa cover the primary signal.

**Cold start latency.** Cloud Run scales to zero; a cold start on the first Cloud Tasks push after a quiet period could add 2–5s latency to the ingest handler. Mitigation: acceptable for background pipeline tasks; set `minInstances: 1` if cold-start jitter causes Cloud Tasks timeout failures.

### Organisational risks

**Custom topic abuse.** Self-serve topic creation removes the manual review gate. A user could create a topic with very broad keywords or a large URL list designed to ingest thousands of articles/day, driving up API costs. Mitigation: hard cap of 500 articles/day per custom topic; per-user daily article cap (default 2,000 across all custom topics); Cloud Monitoring alert on LLM cost > $20/day triggers automatic topic pause pending review.

**Natural language extraction quality.** Claude Haiku may extract poor keywords from ambiguous descriptions ("I want AI news" → too broad; "I want news about the thing from OpenAI" → too vague). Mitigation: require minimum 20 characters in the description; show the extracted keywords to the user for review before confirming; provide an "edit keywords" step in the wizard. Low-quality extractions surface naturally in the preview step.

**Moderation of LLM output.** Claude occasionally produces hallucinated entity names or incorrect topic tags. Mitigation: relevance scoring acts as a quality gate; feedback (thumbs down) triggers a re-summary queue in Phase 3.

---

## 11. Phased Roadmap

### Phase 1 — Core pipeline + web app (weeks 1–4)

**Goal:** A working end-to-end pipeline and a minimal read-layer web app. Internal use only. No billing, no RSS delivery — validate the core loop first.

Deliverables:

- Firestore schema + Security Rules deployed.
- Identity Platform configured (Google OAuth + magic link).
- Web ingestion for 10 curated topics (AI domain as validation set; source lists include expert opinion sources).
- Processing pipeline: dedup → embed → cluster → summarise (with attribution + perspective prompt).
- Next.js web app: feed page (today/week/month/year), cluster card, topic filter.
- Overview / briefing page.
- Cloud Build CI/CD pipeline.

Exit criteria: the founding team can use Pulse daily and rate ≥ 80% of clusters as relevant. Summaries must surface expert viewpoints, not just event headlines.

---

### Phase 2 — Billing + delivery + social + custom topics (weeks 5–8)

**Goal:** Social sources live; custom topic creation shipped; email digests, RSS, and billing shipped; closed beta with 20–50 external users.

Deliverables:

- Stripe Checkout integration for Starter, Pro, Team monthly plans.
- Webhook handler to update `planTier` on `subscription.created/updated/deleted`.
- Plan enforcement: topic count limit, cadence limit.
- RSS feed per topic (`/api/v1/rss/[slug]`), cached in GCS, CDN-served.
- Combined RSS feed (`/api/v1/rss/all`).
- Reddit + X ingestion via ScrapeCreators.
- Custom topic creation wizard: natural language mode (Claude Haiku extraction + keyword editor + preview) and URL list mode (type detection + URL validation).
- Custom topic management: edit, pause, delete.
- Email digest (Resend, daily at 07:30).
- Plan limits UI in settings.
- Basic observability: Cloud Monitoring dashboards for pipeline health, LLM cost, Firestore reads.
- Per-topic and per-user daily article caps enforced.

Exit criteria: 50 beta users, ≥ 40% weekly active, ≥ 3 users have created a custom topic, < 5 pipeline failures per week.

---

### Phase 3 — Delivery breadth + API (weeks 9–14)

**Goal:** Public launch. All core delivery channels. REST API for Pro users.

Deliverables:

- TikTok + Instagram ingestion.
- Obsidian sync (nightly GCS export + signed URL).
- Slack/Teams webhook delivery.
- REST API (feed, topics, search endpoints).
- MFA (TOTP via Identity Platform).
- GDPR deletion flow.
- Public marketing site with waitlist → open signup.

Exit criteria: public launch, 500 registered users, $3K MRR.

---

### Phase 4 — Team plan + custom topics (weeks 15–24)

**Goal:** Land first 3–5 paying team accounts. Unlock the network-effect flywheel.

Deliverables:

- Team workspace: shared topics, member invite, admin role.
- SAML/OIDC SSO (Identity Platform multi-tenancy).
- Custom topic builder UI.
- Cluster feedback (thumbs up/down) + quality alerting.
- Digest history (calendar-picker feed).
- Trending topics page.
- Topic discovery / recommendations.

Exit criteria: 3 paying Team accounts, $15K MRR.

---

## 12. Open Questions

**Topic taxonomy.** The initial 10-topic set is a hypothesis. Should we launch with broader topics (e.g. "AI news" as a single catch-all) and let users drill down via tag filtering, or launch with narrow topics and let users subscribe to several? Narrow topics have higher signal per cluster but risk feeling sparse on slow news days.

**Free tier limits.** One topic, daily cadence is the current free tier. Custom topics require Starter+. Is this the right gate? An alternative: allow one custom topic on the free tier (with daily cadence only) to let users experience the creation flow before upgrading — which may drive higher conversion by demonstrating the product's depth earlier.

**Natural language extraction confidence.** When Claude Haiku extracts keywords from a description, how do we communicate extraction quality to the user? Options: (a) show a confidence score per keyword; (b) colour-code keywords by source (AI-suggested vs user-added); (c) run a quick validation search and show "found X articles in the last 7 days" before confirming. The dry-run preview is the strongest signal but adds latency to the creation flow (~10s for an Exa AI query). Is that acceptable?

**URL list scope.** Should Pulse support authenticated sources in a future version — e.g. private RSS feeds that require a username/password, or newsletters forwarded via email? This would meaningfully expand the URL list use case for enterprise users but adds significant complexity (credential storage, email ingestion pipeline).

**Custom topic isolation vs. shared pipeline.** Two users who create nearly identical custom topics (same keywords, same sources) each get their own independent pipeline. This wastes API credits. A smarter system would detect near-identical topics and share the pipeline (as curated topics do). Is this worth the complexity in v1, or a Phase 4 optimisation?

**Cluster granularity.** Current clustering threshold (cosine similarity ≥ 0.82) produces tight clusters of 2–5 articles. On high-volume topics this may produce 30+ clusters in a day, which is too many for the overview/briefing view. Should we cap clusters per topic per day (e.g. top 10 by recency) or merge at a lower threshold for the overview view only? Custom topics with narrow URL lists may only produce 1–3 clusters/day, which raises the floor question: what does an empty or nearly-empty day look like in the feed?

**Long-form social content.** TikTok and Instagram captions are short; their value is in engagement signals (view count, shares) rather than content. Should social posts be displayed as a separate "buzz" signal layer (e.g. "this cluster is trending on TikTok: 2.3M views") rather than as source articles in their own right?

**Data retention.** How long should raw articles and processed clusters be retained? Keeping everything forever increases Firestore costs linearly. Options: retain clusters indefinitely (they are small), purge raw articles after 90 days (they are large and not directly user-facing). Custom topics raise an additional question: should a user's custom topic data be deleted when they downgrade to a plan that no longer supports that topic count?

**Pricing anchoring.** The Starter tier at $9/month may be too cheap to signal quality or too expensive for individual hobbyists. Consider whether a $19 Starter / $49 Pro / $99 Team ladder converts better than the current $9 / $29 / $79 structure. Run a landing page A/B test before Phase 3 launch. Custom topic creation as a Starter feature is a meaningful upgrade hook — test messaging that leads with "build your own AI briefing" rather than "access more curated topics".

---

_Last updated: May 2026 · Pulse PRD v1.0_
