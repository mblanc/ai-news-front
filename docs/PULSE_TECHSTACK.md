# Pulse — Technical Stack Reference

> AI-powered news aggregation SaaS · Next.js 15 · TypeScript · Google Cloud Platform

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Repository Structure](#2-repository-structure)
3. [Data Layer](#3-data-layer)
4. [GCP Infrastructure](#4-gcp-infrastructure)
5. [Ingestion Pipeline](#5-ingestion-pipeline)
6. [Processing Pipeline](#6-processing-pipeline)
7. [Fanout & Delivery](#7-fanout--delivery)
8. [API Design](#8-api-design)
9. [Auth & Identity](#9-auth--identity)
10. [Billing Integration](#10-billing-integration-stripe)
11. [CI/CD Pipeline](#11-cicd-pipeline)
12. [Observability](#12-observability)
13. [Security](#13-security)
14. [Environment Configuration](#14-environment-configuration)
15. [Cost Model](#15-cost-model)
16. [Local Development](#16-local-development)
17. [Testing Strategy](#17-testing-strategy)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  GCP Project: pulse-prod                                        │
│                                                                 │
│         ┌───────────────────────────────────────────┐           │
│         │  Cloud Run · pulse (Next.js 15 monolith)  │           │
│         │                                           │           │
│         │  /app/(dashboard)   — web UI              │           │
│         │  /app/api/v1        — public REST API     │  ◄──────  │─── Cloud Tasks (HTTP push)
│         │  /app/api/tasks/*   — pipeline handlers   │           │
│         │  /app/api/schedule/* — scheduler fanout   │  ◄──────  │─── Cloud Scheduler
│         │  /app/api/webhooks  — Stripe              │           │
│         └───────────────────┬───────────────────────┘           │
│                             │                     ▲             │
│                      Cloud Pub/Sub          Cloud Tasks         │
│                      (digest fanout)        (job chain)         │
│                             │                                   │
│  ┌──────────────────────────▼───────────────────────────────┐   │
│  │  Firestore (documents + vector search + realtime)        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Identity Platform · Cloud Storage · Secret Manager             │
│  Vertex AI (Claude + Embeddings) · Cloud Build · Artifact Reg   │
│  Cloud Monitoring · Cloud Logging · Cloud Trace · Cloud Armor   │
└─────────────────────────────────────────────────────────────────┘

External APIs: ScrapeCreators · Firecrawl · Exa AI · Stripe · Resend
```

### Design principles

- **Monolith first** — one Cloud Run service, one Dockerfile, one deploy target. Pipeline task handlers live at `/api/tasks/*` alongside the web UI. Split only when resource contention is measured.
- **Fully GCP-native** — Firestore, Identity Platform, Vertex AI, Cloud Tasks. Single GCP bill.
- **Firestore as single source of truth** — replaces PostgreSQL + pgvector + Supabase Realtime. Native real-time listeners and built-in KNN vector search (`findNearest`).
- **Identity Platform over basic Firebase Auth** — adds MFA, SAML/OIDC federation, blocking functions, and audit logs. Same Firebase SDK.
- **Cloud Tasks over Redis/BullMQ** — each pipeline step is a Next.js route handler. No always-on infrastructure, scales to zero.

---

## 2. Repository Structure

```
pulse/
├── apps/
│   └── web/                         # Next.js 15 monolith
│       ├── app/
│       │   ├── (auth)/              # Login, signup, onboarding
│       │   ├── (dashboard)/         # Authenticated app shell
│       │   │   ├── feed/            # News feed (today/week/month/year/overview)
│       │   │   ├── topics/          # Topic subscription management
│       │   │   └── settings/        # Plan, delivery, webhooks, MFA
│       │   ├── (marketing)/         # Landing, pricing, blog
│       │   └── api/
│       │       ├── auth/session/    # Mint / revoke session cookie
│       │       ├── tasks/           # Cloud Tasks push endpoints
│       │       │   ├── ingest/      # Fetch articles from sources
│       │       │   ├── process/     # Score, embed, cluster articles
│       │       │   ├── fanout/      # Write feed items + trigger delivery
│       │       │   ├── digest/      # Email digest (Cloud Tasks + Pub/Sub push)
│       │       │   ├── webhook/     # User webhook delivery
│       │       │   └── obsidian/    # Obsidian Markdown export
│       │       ├── schedule/        # Cloud Scheduler trigger endpoints
│       │       │   ├── ingest/      # Fan out ingest tasks per active topic
│       │       │   ├── digest/      # Publish to Pub/Sub pulse-digest
│       │       │   └── obsidian/    # Fan out obsidian tasks per user
│       │       ├── webhooks/stripe/ # Stripe webhook receiver
│       │       └── v1/              # Public REST API (Pro+ tiers)
│       ├── components/
│       └── lib/
│           ├── firebase/            # Firebase client SDK (browser)
│           ├── firebase-admin/      # Firebase Admin SDK (server)
│           ├── stripe/
│           └── vertex/              # Vertex AI clients
│
├── packages/
│   ├── db/                          # Firestore collections, types, admin + client SDKs
│   ├── scraping/                    # ScrapeCreators + Firecrawl + Exa wrappers
│   ├── ai/                          # Embeddings, Claude calls, cluster algorithm
│   ├── tasks/                       # enqueueTask() Cloud Tasks helper
│   └── config/                      # Env schema (zod), plan limits
│
├── functions/                       # Identity Platform blocking functions only
│   └── src/
│       ├── beforeCreate.ts          # Provision Firestore profile, block disposable emails
│       └── beforeSignIn.ts          # Block suspended accounts
│
├── infra/
│   ├── terraform/                   # All GCP resources
│   └── cloudbuild/cloudbuild.yaml   # Build + deploy pipeline
│
└── firestore/
    ├── firestore.rules
    └── firestore.indexes.json
```

**Toolchain:**

| Tool | Version | Purpose |
|------|---------|---------|
| pnpm | 9.x | Package manager |
| Turborepo | 2.x | Monorepo task graph |
| TypeScript | 5.5+ | Strict mode everywhere |
| ESLint | Flat config | Linting |
| Prettier | 3.x | Formatting |
| Vitest | 2.x | Unit + integration tests |

---

## 3. Data Layer

### 3.1 Firestore

**Database:** `(default)` in `us-central1`, Native mode.

Firestore replaces PostgreSQL + pgvector + Supabase Realtime in one service. Subcollections model per-user data with natural access isolation; `onSnapshot()` replaces polling; `findNearest()` replaces pgvector.

#### Collection schema

```
firestore/
│
├── profiles/{userId}          # planTier, stripeCustomerId, apiKey, …
├── topics/{topicId}           # slug, keywords, sourceIds, cadenceMinutes, isCurated
├── sources/{sourceId}         # type (rss|scrape|reddit|x|…), config, enabled
├── articles/{articleId}       # topicId, url, urlHash, bodyMd, relevanceScore, embedding, status
├── clusters/{clusterId}       # topicId, summary, topicTag, sentiment, entities, articleIds, periodDay/Week/Month
├── subscriptions/{uid}/topics/{topicId}   # delivery: ['web','email','rss','webhook']
└── userFeeds/{uid}/items/{clusterId}      # readAt, bookmarked
```

#### Firestore indexes

- `articles`: `(topicId, status, ingestedAt DESC)`
- `clusters`: `(topicId, periodDay DESC)` and `(topicId, topicTag, ingestedAt DESC)`
- `articles` vector index: `(topicId, embedding)` — 768-dim flat index for `findNearest()`

#### Typed client packages

- `packages/db/admin.ts` — Admin SDK for server/task route handlers (bypasses Security Rules)
- `packages/db/client.ts` — Browser SDK for client components

### 3.2 Vector search

`findNearest()` runs directly on Firestore — no separate vector database. Query filters by `topicId` + `status=processed`, uses cosine distance ≤ 0.18 (≈ similarity ≥ 0.82).

### 3.3 Cloud Storage (GCS)

```
gs://pulse-prod-exports/
  obsidian/{userId}/{date}.md
  rss/{topicSlug}/feed.xml
  exports/{userId}/archive-{date}.zip
```

---

## 4. GCP Infrastructure

All resources defined in Terraform. Deploy: `terraform apply -var-file=prod.tfvars`.

### Cloud Run

Single service for the entire product. HTTP requests (web + tasks + scheduler + Stripe webhooks) all hit the same service on different route paths.

- **Scaling:** 0–20 instances, 80 concurrent requests/instance
- **Resources:** 4 vCPU / 2 GiB — headroom for concurrent embedding + Claude calls
- **Billing:** CPU charged only when actively serving a request (`cpu_idle = true`)

### Cloud Tasks queues

| Queue | Rate | Retries | Purpose |
|-------|------|---------|---------|
| `pulse-ingest` | 10 rps / 5 concurrent | 5 × exponential backoff | Fetch articles from sources |
| `pulse-process` | 20 rps / 10 concurrent | 3 × backoff | Score, embed, cluster |
| `pulse-fanout` | 50 rps / 20 concurrent | 3 | Write feed items + webhooks |

All tasks are HTTP pushes to `/api/tasks/*` on the same Cloud Run service, authenticated via OIDC token.

### Cloud Pub/Sub

- Topic `pulse-digest` → push subscription → `/api/tasks/digest`
- DLQ topic `pulse-dlq` for failed messages (max 5 delivery attempts)

### Cloud Scheduler

| Job | Schedule (UTC) | Target |
|-----|---------------|--------|
| ingest-hourly | `0 * * * *` | `/api/schedule/ingest` |
| ingest-daily | `0 6 * * *` | `/api/schedule/ingest` |
| digest-morning | `30 7 * * *` | `/api/schedule/digest` |
| obsidian-sync | `0 1 * * *` | `/api/schedule/obsidian` |

### Secret Manager

All secrets (Firebase service account key, Stripe keys, API keys, auth cookie secret) stored in Secret Manager. No `.env` files in Git. Secrets mounted as env vars into Cloud Run at runtime.

---

## 5. Ingestion Pipeline

### Source adapters (`packages/scraping`)

| Source type | Adapter |
|-------------|---------|
| `rss` | `rss-parser` → parse feed items |
| `scrape` | Firecrawl → JS-rendered site → Markdown |
| `reddit`, `x`, `tiktok`, `ig` | ScrapeCreators API |
| `search` | Exa AI semantic web search |

### Ingest task handler (`/api/tasks/ingest`)

```
POST { topicId }

1. Load topic + its sources from Firestore
2. Fetch articles from each source adapter
3. Deduplicate by sha256(url) — skip existing articles
4. Batch-write new articles with status=raw
5. Update source.lastFetchedAt
6. Enqueue process task if new articles exist
```

Returns `200` on success (Cloud Tasks deletes the task). Returns `500` on failure (Cloud Tasks retries).

---

## 6. Processing Pipeline

### AI clients (`packages/ai`)

| Model | Purpose | Provider |
|-------|---------|---------|
| `text-embedding-004` | 768-dim article embeddings | Vertex AI |
| `claude-haiku-4-5` | Relevance scoring (0–10) | Vertex AI (Anthropic) |
| `claude-sonnet-4-6` | Cluster summarisation → JSON | Vertex AI (Anthropic) |

### Process task handler (`/api/tasks/process`)

```
POST { topicId, articleIds }

1. Relevance scoring (Claude Haiku) — score each article 0–10 against topic keywords
2. Discard articles scoring < 5; mark discarded in Firestore
3. Embed remaining articles (Vertex text-embedding-004)
4. Cluster via Firestore KNN findNearest — group similar articles (cosine distance ≤ 0.18)
5. Summarise each cluster (Claude Sonnet) → { summary, topicTag, sentiment, entities }
6. Write cluster documents with periodDay/Week/Month fields
7. Enqueue fanout task
```

---

## 7. Fanout & Delivery

### Fanout task handler (`/api/tasks/fanout`)

```
POST { topicId }

1. Find clusters ingested in the last 5 minutes for this topic
2. Find all subscribers (collectionGroup query on subscriptions)
3. Batch-write userFeeds/{uid}/items/{clusterId} for each subscriber × cluster
4. Enqueue webhook tasks for subscribers with delivery=['webhook']
```

### Digest handler (`/api/tasks/digest`)

Handles both Cloud Tasks push and Pub/Sub push (different payload shapes — Pub/Sub wraps data in base64).

```
POST { window: 'daily' | 'weekly' }

1. Find all users with email delivery
2. For each user: fetch subscribed topics → recent clusters → render HTML email
3. Send via Resend
```

### Obsidian Sync

Nightly job (01:00 UTC) per user with `delivery=['obsidian']`:
- Fetches yesterday's clusters for all subscribed topics
- Renders a Markdown file with YAML frontmatter
- Writes to `gs://pulse-prod-exports/obsidian/{userId}/{date}.md`
- Generates a 7-day signed GCS URL stored in user's profile

---

## 8. API Design

```
GET  /api/v1/feed?topic=&period=day|week|month|year&tag=
GET  /api/v1/topics
POST /api/v1/topics/subscribe      body: { topicId, delivery[] }
GET  /api/v1/rss/:slug             → RSS 2.0 (public)
GET  /api/v1/search?q=&topic=      → vector KNN via Firestore findNearest
```

**Auth:** `Authorization: Bearer {apiKey}`

**Rate limiting:** Cloud Armor (100 req/min/IP) + per-key token buckets in middleware.

**RSS feeds:** Generated on-demand by a route handler, written to GCS, cached by Cloud CDN for 1 hour.

---

## 9. Auth & Identity

### Identity Platform vs Firebase Auth

Pulse uses **Google Cloud Identity Platform** (enterprise upgrade of Firebase Auth). Same SDK, materially better capabilities:

| Feature | Firebase Auth | Identity Platform |
|---------|--------------|-------------------|
| Email + password / magic link / Google OAuth | ✅ | ✅ |
| Phone / SMS MFA | Limited | Full |
| TOTP (authenticator app) MFA | ❌ | ✅ |
| SAML / OIDC federation (SSO) | ❌ | ✅ |
| Blocking functions | ❌ | ✅ |
| Audit logging | ❌ | ✅ |
| Price | Free to 10K MAU | Free to 10K MAU, then $0.0055/MAU |

### Sign-in flows

- **Google OAuth** — recommended primary flow (`signInWithPopup`)
- **Magic link** — passwordless email (`sendSignInLinkToEmail` / `signInWithEmailLink`)

Both flows POST the ID token to `/api/auth/session`, which mints a 14-day HttpOnly session cookie via `adminAuth.createSessionCookie`.

### Session verification

`next-firebase-auth-edge` middleware verifies the session cookie on every request. Authenticated user's `uid` is available in Server Components via `getTokens(cookies(), …)`.

### Blocking functions

Run server-side before account creation/sign-in (no client-side code):

- **`beforeCreate`** — block disposable email domains, provision Firestore `profiles/{uid}` document with `planTier: 'free'` and a generated `apiKey`
- **`beforeSignIn`** — block suspended accounts

### Plan enforcement

```typescript
// packages/config/src/plans.ts
{
  free:    { topics: 1,  refreshMinutes: 1440, apiAccess: false, mfa: false, sso: false },
  starter: { topics: 3,  refreshMinutes: 240,  apiAccess: false, mfa: true,  sso: false },
  pro:     { topics: 10, refreshMinutes: 60,   apiAccess: true,  mfa: true,  sso: false },
  team:    { topics: 25, refreshMinutes: 60,   apiAccess: true,  mfa: true,  sso: true  },
}
```

Enforced in Firestore Security Rules (data access) and Next.js middleware (API rate limits).

---

## 10. Billing Integration (Stripe)

Stripe webhook receiver at `/api/webhooks/stripe` handles:
- `customer.subscription.created/updated` → update `profiles/{uid}.planTier`
- `customer.subscription.deleted` → downgrade to `free`

Profile lookup is by `stripeCustomerId`. Price IDs map to plan tiers via env vars.

| Product | Env var | Tier |
|---------|---------|------|
| Starter Monthly | `STRIPE_PRICE_STARTER` | starter |
| Pro Monthly | `STRIPE_PRICE_PRO` | pro |
| Team Monthly | `STRIPE_PRICE_TEAM` | team |

---

## 11. CI/CD Pipeline

Cloud Build pipeline (`infra/cloudbuild/cloudbuild.yaml`):

```
1. pnpm install --frozen-lockfile
2. pnpm turbo run typecheck lint test
3. docker build → push to Artifact Registry
4. firebase deploy --only firestore   (rules + indexes)
5. firebase deploy --only functions   (blocking functions)
6. gcloud run deploy pulse            (single service)
```

Machine type: E2_HIGHCPU_8. Logs to Cloud Logging only.

---

## 12. Observability

### Structured logging

`@google-cloud/logging` — structured JSON logs with `INFO/WARNING/ERROR` severity, shipped to Cloud Logging.

### Custom metrics (Cloud Monitoring)

- `pulse/articles_ingested` — by topicId, sourceType
- `pulse/articles_discarded` — by topicId
- `pulse/clusters_created` — by topicId, topicTag
- `pulse/llm_tokens_used` — by model, jobType
- `pulse/api_credits_consumed` — by vendor

### Alerting

| Alert | Condition | Channel |
|-------|-----------|---------|
| Ingest failure rate | > 10% over 15 min | PagerDuty + Slack |
| Cloud Tasks queue depth | > 500 tasks | Slack |
| Cloud Run error rate | > 5% over 5 min | PagerDuty |
| Firestore read spike | > 500K reads/hour | Slack |
| LLM cost spike | > $20/day | Email |

### Distributed tracing

OpenTelemetry + `@google-cloud/opentelemetry-cloud-trace-exporter` via `instrumentation.ts` → Cloud Trace.

---

## 13. Security

### IAM Service Accounts

| Service Account | Purpose |
|----------------|---------|
| `pulse-app@` | Cloud Run service — Firestore, Secret Manager, Cloud Tasks, Pub/Sub, GCS, Logging, Monitoring |
| `pulse-scheduler-invoker@` | Cloud Scheduler → `/api/schedule/*` (run.invoker only) |
| `pulse-pubsub-invoker@` | Pub/Sub push → `/api/tasks/digest` (run.invoker only) |
| `pulse-tasks-invoker@` | Cloud Tasks push → `/api/tasks/*` (run.invoker only) |
| `pulse-cloud-build@` | Build + deploy (run.developer, artifactregistry.writer) |

### Firestore Security Rules

Rules replace Postgres RLS. Key policies:
- **Profiles** — owner read only; create blocked (provisioned by blocking function); users cannot self-modify `planTier`, `stripeCustomerId`, `apiKey`
- **Topics / Sources / Articles** — authenticated read for topics/clusters; sources and articles are admin-only (task route handlers use Admin SDK, bypassing rules)
- **Subscriptions** — owner read/write; free plan max 1 topic enforced in rules
- **User feed items** — owner read; owner can update `readAt` and `bookmarked` only; create/delete by fanout task handler only

### Secrets hygiene

- No `.env` files in Git
- All secrets in Secret Manager, mounted as env vars into Cloud Run
- Identity Platform audit logs stream to Cloud Logging automatically

---

## 14. Environment Configuration

Key env vars validated at startup with Zod:

| Group | Key vars |
|-------|---------|
| Firebase (public) | `NEXT_PUBLIC_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, … |
| Firebase Admin | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| Auth | `AUTH_COOKIE_SECRET` (≥ 32 chars) |
| GCP | `GOOGLE_CLOUD_REGION`, `CLOUD_RUN_APP_URL`, `TASKS_INVOKER_SA`, `GCS_BUCKET` |
| Scraping | `SCRAPECREATORS_API_KEY`, `FIRECRAWL_API_KEY`, `EXA_API_KEY` |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` |
| Comms | `RESEND_API_KEY` |
| App | `NEXT_PUBLIC_APP_URL`, `NODE_ENV`, `USE_SYNC_TASKS` |

`USE_SYNC_TASKS=true` calls task handlers directly in dev, skipping Cloud Tasks.

---

## 15. Cost Model

Monthly at ~500 active users, 20 active topics, hourly cadence.

### GCP infrastructure

| Service | $/month |
|---------|--------|
| Cloud Run (single service) | ~$10 |
| Firestore (~50M reads, 5M writes) | ~$35 |
| Identity Platform (≤ 10K MAU) | $0 |
| Cloud Tasks / Scheduler / Pub/Sub | ~$3 |
| Cloud Storage | ~$2 |
| Cloud Build | ~$15 |
| Cloud Armor + CDN + Monitoring | ~$14 |
| **GCP subtotal** | **~$80** |

### External APIs

| Service | $/month |
|---------|--------|
| ScrapeCreators | $10–47 |
| Firecrawl Hobby | $16 |
| Exa AI | $0–30 |
| Vertex AI (Claude Haiku + Sonnet) | ~$25 |
| Vertex AI Embeddings (text-embedding-004) | ~$0 (free quota) |
| Resend | $0–20 |
| **External subtotal** | **~$51–138** |

**Total: ~$130–220/month** at 500 users. Breakeven at ~15–20 paying Starter subscribers.

---

## 16. Local Development

### Prerequisites

Node 22, pnpm 9, gcloud CLI, firebase CLI.

### Setup

```bash
# Install dependencies
pnpm install

# Authenticate with GCP (for Vertex AI)
gcloud auth application-default login

# Start Firebase emulators (Firestore + Auth + Functions)
firebase emulators:start --only auth,firestore,functions

# Copy env template and fill in values
cp apps/web/.env.example apps/web/.env.local

# Start dev server (web UI + task routes on same server)
pnpm dev
```

Key `.env.local` settings for local dev:
- `FIRESTORE_EMULATOR_HOST=localhost:8080` and `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099` — both SDKs auto-connect to emulators when these are set
- `CLOUD_RUN_APP_URL=http://localhost:3000` — tasks enqueue back to the local server
- `USE_SYNC_TASKS=true` — skip Cloud Tasks, call handlers directly

### Useful commands

```bash
pnpm turbo run typecheck              # type check all packages
pnpm turbo run test                   # run all tests
firebase emulators:export ./emulator-data   # snapshot emulator state
pnpm --filter db run seed             # seed local Firestore with test data

# Manually trigger an ingest
curl -X POST http://localhost:3000/api/tasks/ingest \
  -H 'Content-Type: application/json' \
  -d '{"topicId":"test-topic-id"}'

# Forward Stripe webhooks to local
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## 17. Testing Strategy

### Unit tests (Vitest)

Pure functions: clustering algorithm, relevance score parsing, period value helpers, Markdown renderer.

### Integration tests (Vitest + Firebase emulator)

Task handlers tested against the local Firestore emulator — real reads and writes, no mocking. Run with:

```bash
firebase emulators:exec --only firestore,auth "pnpm turbo run test"
```

### End-to-end tests (Playwright)

Critical auth and subscription flows (magic link sign-in, topic subscription → feed render). Run against local dev server or staging:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm --filter web exec playwright test
```

---

*Last updated: May 2026 · Pulse v1.0*
