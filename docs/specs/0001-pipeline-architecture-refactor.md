# Spec: Refactor and Deepen the Article Ingestion Pipeline & Digest Architecture

**Status**: Ready for Agent (`ready-for-agent`)  
**Date**: July 29, 2026

## Problem Statement

Currently, `ingest.ts` is a 1,348-line shallow monolithic script that combines article fetching, RSS parsing, web scraping, Playwright headless browsing, Gemini LLM scoring, Firestore document reads/writes, vector similarity clustering, and multi-scope digest generation into imperative loops. This causes significant architectural friction: intermediate pipeline state leaks into API routes, error recovery and rate-limiting lack locality, unit testing requires complex mock setups across 5 external services, and background cron jobs are tightly bound to raw implementation details.

## Solution

Collapse and deepen `ingest.ts` into two deep, well-bounded modules: `IngestionPipeline` (for 9-step article processing) and `DigestGenerator` (for daily/weekly/monthly digest synthesis). Each module presents a minimal, high-leverage interface behind clean seams, using dependency injection for external adapters (Gemini LLM, web scrapers, Firestore persistence). Progress and live streaming updates will be emitted via a typed `IngestProgressEvent` callback.

## User Stories

1. As a system administrator, I want article ingestion to run reliably behind a single pipeline interface, so that scheduled background cron jobs run deterministically without leaking intermediate pipeline states.
2. As a platform operator, I want real-time progress updates during manual ingestion triggers, so that I can inspect pipeline stage completion, error events, and article stats via Server-Sent Events (SSE).
3. As a developer, I want external dependencies (Gemini LLM, Web Scrapers, Firestore) to be injectable into the ingestion pipeline, so that I can write fast, deterministic unit and integration tests using offline mock adapters.
4. As an automated cron job, I want digest generation to be decoupled from article ingestion, so that daily, weekly, and monthly news digests can be refreshed independently without re-running full article scraping.
5. As a news platform user, I want ingested articles to be automatically scored and assigned to semantic clusters, so that duplicate coverage is grouped together cleanly by topic.
6. As a system maintainer, I want error handling and retry logic to be concentrated inside the ingestion pipeline module, so that transient network failures do not crash the entire ingestion cycle or leave partial documents in Firestore.
7. As a reader, I want high-impact semantic clusters to be ranked and synthesized into executive digests, so that I can quickly catch up on key AI developments across temporal scopes.
8. As an API developer, I want Next.js API routes (`POST /api/ingest`, `POST /api/cron/ingest`, `POST /api/digest`) to interact with simple module interfaces, so that API handler logic remains clean and thin.

## Implementation Decisions

- **Module Separation**: Split `ingest.ts` into two deep modules: `IngestionPipeline` (handling discovery, scraping, deduplication, scoring, embedding, and clustering) and `DigestGenerator` (handling cluster ranking, impact calculation, and summary generation across daily/weekly/monthly/all-time scopes).
- **Interface Seams**:
  - `IngestionPipeline` interface exposes `ingest(sources, options)` for executing the full 9-step ingestion flow.
  - `DigestGenerator` interface exposes `generateDigest(scope)` for synthesizing news summaries for a given temporal scope.
- **Dependency Injection**: Modules use a factory/constructor pattern accepting injectable adapters for content extraction, LLM scoring, vector clustering, and persistence storage. Default factory functions automatically wire production adapters (Gemini, Firestore, Readability/Playwright).
- **Progress Reporting**: `IngestionPipeline` accepts a typed `onProgress?: (event: IngestProgressEvent) => void` observer callback. `IngestProgressEvent` carries structured metadata (`stage`, `stepNumber`, `totalSteps`, `message`, `stats`), allowing API routes to format SSE messages cleanly.
- **Error Locality & Resilience**: Network retries, domain rate limits, and fallback extraction logic concentrate inside the pipeline execution engine rather than spreading across API routes.

## Testing Decisions

- **Test Seams**: All automated tests execute against the primary module interface seams (`IngestionPipeline` and `DigestGenerator`), avoiding tests that reach past the interface into private internal helper functions.
- **Injectable Fakes**: Unit tests pass offline fake adapters (fake scraper, mock LLM scorer, memory store repository) to test the 9-step ingestion sequence, duplicate detection, and cluster assignments without network or Cloud API access.
- **Prior Art**: Modeled after existing test conventions in `src/lib/__tests__/`, expanding coverage to full end-to-end pipeline execution without requiring live Firestore emulator or Gemini API keys.

## Out of Scope

- Frontend UI modifications to news list, filter panels, or summary modals.
- Schema changes to Firestore `articles`, `clusters`, or `sources` collections.
- Replacement of Gemini LLM or embedding models (`gemini-3.5-flash-lite`, `gemini-embedding-2`).
- Addition of new external news sources or RSS feed providers.

## Further Notes

- This spec implements the top architectural recommendation identified during the codebase architecture review.
- Terminology used aligns strictly with `CONTEXT.md` (Domain Glossary) and `AGENTS.md` rules.
