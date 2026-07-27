# AGENTS.md

This file provides guidance to Code Agent when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server

npm run check        # TypeScript type checking (tsc --noEmit)
npm run lint         # ESLint
npm run format       # Prettier
npm run preflight    # format + check + lint + test (full CI)

npm run test         # Run unit tests with Vitest (excludes integration)
npm run test:watch   # Vitest watch mode
npm run test:integration  # Integration tests only
```

## Architecture Overview

This is an AI news aggregation platform that ingests articles from 23 sources, scores their relevance, clusters them by semantic similarity, and displays them with LLM-generated summaries.

### Data Flow

```
Sources (RSS + web) → Scrape URLs → Deduplicate → Scrape content → Score relevance (LLM)
→ Generate embeddings → Cluster by similarity → Summarize clusters → Firestore → Frontend
```

The 9-step ingestion pipeline lives in `lib/ingest.ts`. It runs hourly via a node-cron job started in `instrumentation.ts` (Next.js instrumentation hook), and can also be triggered manually via `POST /api/ingest` (SSE streaming) or `POST /api/cron/ingest` (authenticated, used by Cloud Scheduler).

### Key Directories

- `lib/` — Core business logic: `ingest.ts` (pipeline), `cluster.ts` (embeddings + cosine similarity clustering), `scrape.ts` (Readability + Turndown), `rss.ts`, `firebase.ts` (Firestore queries), `types.ts`
- `app/api/` — API routes: `clusters/`, `sources/[id]/`, `ingest/`, `cron/ingest/`
- `app/admin/sources/` — Admin UI for managing news sources
- `components/` — React UI components
- `hooks/` — Client-side state hooks
- `lib/__tests__/` — Unit tests (`*.test.ts`) and integration tests (`*.integration.test.ts`)

### Firestore Collections

- **articles** — Doc ID: SHA-256 of URL. Status flow: `raw → scored → clustered` (or `fetch_failed`, `discarded`)
- **clusters** — LLM summaries, topic tags, sentiment, centroid embeddings, article references
- **sources** — Source configs (url, type `"rss"|"page"`, feedUrl, name, enabled)

### AI/ML Components

- **Embedding model:** `EMBEDDING_MODEL` env var (default: `gemini-embedding-2`, 768-dim vectors)
- **LLM:** `INGEST_MODEL` env var (default: `gemini-3.1-flash-lite`) via `@google/genai`
- **Clustering threshold:** 0.82 cosine similarity
- **Relevance threshold:** Score ≥ 5 out of 10 to keep an article
- **Cluster matching window:** Articles matched against clusters from last 3 days

### Content Scraping Fallback Chain

1. Standard fetch + Readability + Turndown
2. CloakBrowser (headless Playwright, for bot-protected sites)
3. Firecrawl API (if `FIRECRAWL_API_KEY` set)
4. Skip article

### Environment Variables

See `env.example`. Required:

- `GOOGLE_CLOUD_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, `GOOGLE_APPLICATION_CREDENTIALS`
- `GOOGLE_CLOUD_LOCATION`, `INGEST_MODEL`, `EMBEDDING_MODEL`
- `CRON_SECRET` — Bearer token for `POST /api/cron/ingest`

Optional: `FIRECRAWL_API_KEY`

## Tech Stack

- **Next.js 16** with App Router, React 19, TypeScript 6, Tailwind CSS 4
- **Firestore** (`@google-cloud/firestore`) for persistence
- **Gemini** (`@google/genai`) for scoring, embedding, summarization
- **Radix UI + shadcn/ui** for component library
- **Vitest** for testing (node environment)
- Path alias `@/*` maps to project root
