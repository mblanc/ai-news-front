# Implementation Plan: Scheduled Agentic Digest Video Pipeline

> **Source Spec**: `docs/specs/0002-agentic-digest-video-pipeline.md`  
> **Status**: Ready for Review (No code written yet — awaiting approval before `/agent-skills:build`)

## Overview

Automate daily `09:00 Europe/Paris` generation of 6 narrated Swiss/Material 3 digest videos (one per category) via **Antigravity Headless CLI (`agy -p`)** running in parallel **Cloud Run Job array tasks (`tasks=6`)**, persisting mastered MP4s (`<= 120s`, `-16 LUFS`) to a private GCS bucket and displaying available videos inline in the **Daily Digest** cartouche (`src/components/daily-digest.tsx`) via server-signed URLs with human feedback persistence.

---

## Architecture Decisions

1. **Fail-Fast Container Auth Gate (Task 1 first)**: Validate `agy -p` headless auth inside `node:26-bookworm-slim` (`AGY_ADC_AUTH=true` vs. Secret Manager OAuth bundle) *before* writing downstream worker logic.
2. **Parallel Cloud Run Job Array (`tasks=6`)**: `POST /api/cron/video` spawns one Cloud Run Job execution with `taskCount: 6`; each container reads `CLOUD_RUN_TASK_INDEX` (`0..5`) -> `VIDEO_CATEGORIES[idx]`, preventing sequential 30+ minute runs and isolating failures per category.
3. **Antigravity Core + Deterministic Envelope**: `agy -p` handles creative authoring (`hyperframes*` / `media-use` skills + `gauntlet-critic` blind visual loop), while tested TypeScript wrappers own Firestore I/O, `--json-schema` parsing, `ffprobe` (`<= 120s`), `ffmpeg loudnorm` (`-16 LUFS`), private GCS upload, and guaranteed publish of the latest valid candidate (`"OURS WINS"` or `"NEEDS_REVIEW"`).
4. **Private Bucket + Server-Signed URLs**: Store only `gcsVideoPath` / `gcsPosterPath` in Firestore `digest_videos`; mint short-lived V4 signed URLs dynamically on the server via IAM `signBlob`.
5. **Conditional Cartouche Embedding**: `DailyDigest` (`src/components/daily-digest.tsx`) queries `/api/videos/latest?scope=daily&category=<cat>` and renders `DigestVideoPlayer` cleanly only when `status === "ready"`.

---

## Dependency Graph

```text
Task 1: Dockerfile.video-worker + agy headless auth smoke test
   │
   ▼
Task 2: Video types + Firestore `digest_videos` repository seam
   │
   ├───────────────────────────────────────┬───────────────────────────────────────┐
   ▼                                       ▼                                       ▼
Task 3: Worker prompts, JSON schema,    Task 6: GCS V4 signer +                 (waits for Task 2)
        critic agent & offline assets          `/api/videos/latest` & `[id]/url`
   │                                       │
   ▼                                       ▼
Task 4: `worker-runner.ts` +           Task 7: `/api/videos/[id]/feedback` +
        `entrypoint.ts` (agy envelope)         `DigestVideoPlayer` in `DailyDigest`
   │
   ▼
Task 5: `cloud-run-jobs.ts` +
        `/api/cron/video` (6 tasks)
   │
   └───────────────────┬───────────────────┘
                       ▼
Task 8: GCP IAM, Cloud Run Job deploy, Cloud Scheduler (`0 9 * * *`), live Task-0 e2e check
```

*(Once Task 2 lands, Task 3/4/5 [Worker side] and Task 6/7 [Web/API/UI side] can run cleanly in parallel!)*

---

## Phase-by-Phase Task Breakdown

### Phase 1: Foundation & Risk De-Risking

#### Task 1: Debian Worker Container & Headless `agy -p` Auth Smoke Test
- **Description:** Create `Dockerfile.video-worker` based on `node:26-bookworm-slim` installing `ffmpeg`, headless Chromium dependencies, pinned `hyperframes`, and the Antigravity CLI (`agy`). Verify locally that `agy -p` authenticates and executes non-interactively inside Linux (`AGY_ADC_AUTH=true` vs. Secret Manager OAuth config) and can invoke `npx hyperframes --version`.
- **Acceptance criteria:**
  - [ ] `Dockerfile.video-worker` builds cleanly for `linux/amd64` without errors.
  - [ ] `docker run` confirms `ffmpeg -version`, `npx hyperframes --version`, and headless Chromium probe succeed.
  - [ ] Documented headless `agy -p` auth mode verified (`AGY_ADC_AUTH=true` succeeds or Secret Manager ~/.gemini mount documented as fallback).
- **Verification:**
  - [ ] Build succeeds: `docker build -f Dockerfile.video-worker -t ai-news-video-worker:dev .`
  - [ ] Manual check: `docker run --rm ... ai-news-video-worker:dev agy -p "Reply OK" --mode auto --dangerously-skip-permissions --output-format json` returns exit 0.
- **Dependencies:** None
- **Files likely touched:**
  - `Dockerfile.video-worker`
  - `cloudbuild.video-worker.yaml`
- **Estimated scope:** S (2 files)

#### Task 2: Video Domain Types & Firestore `digest_videos` Repository
- **Description:** Define shared TypeScript contracts (`VIDEO_CATEGORIES`, `VideoDocument`, `AgyResult`, `FeedbackEntry`) and extend Firestore persistence with clean repository helpers (`saveDigestVideo`, `getLatestDigestVideo`, `getDigestVideoById`, `appendVideoFeedback`) plus offline unit tests using an injected Firestore mock.
- **Acceptance criteria:**
  - [ ] `VIDEO_CATEGORIES` maps indices `0..5` deterministically to `all`, `ai-engineering`, `frontier-research`, `genmedia`, `ecosystem-analysis`, `industry-news`.
  - [ ] `digest_videos` read/write/feedback helpers never store permanent public GCS URLs (only `gcsVideoPath` / `gcsPosterPath`).
  - [ ] Unit tests verify task-index resolution, missing document behavior, and feedback append ordering.
- **Verification:**
  - [ ] Tests pass: `npx vitest run src/lib/video/__tests__/types-and-repo.test.ts`
  - [ ] Check passes: `npm run check && npm run lint`
- **Dependencies:** None (can parallel Task 1)
- **Files likely touched:**
  - `src/lib/video/types.ts`
  - `src/lib/firebase.ts`
  - `src/lib/video/__tests__/types-and-repo.test.ts`
- **Estimated scope:** M (3 files)

#### Checkpoint: Foundation
- [ ] Container auth & binaries verified (`Task 1`)
- [ ] `npm run check && npm run lint && npm run test` pass cleanly (`Task 2`)

---

### Phase 2: Worker Pipeline (`agy -p` Harness & Cloud Run Trigger)

#### Task 3: Baked Prompts, Output Schema, Critic Agent & Offline Assets
- **Description:** Assemble the headless worker knowledge kit (`video-worker/prompts/daily-briefing.md`, `video-worker/schemas/agy-result.schema.json`, `video-worker/agents/gauntlet-critic.md`) and bake offline fonts (`.woff2`), SFX (`.mp3`), `DESIGN.md`, reference stills (`ref-*.png`), and `hyperframes*` / `media-use` skills into `Dockerfile.video-worker`.
- **Acceptance criteria:**
  - [ ] `agy-result.schema.json` strictly requires `projectDir`, `mp4Path`, `criticVerdict` (`"OURS WINS" | "NEEDS_REVIEW"`), `criticRounds` (`<= 3`), `criticNotes`, and `sourcesManifestPath`.
  - [ ] Prompt encodes mandatory chart legibility (`>= 18px` vector SVGs instead of tiny raster chart screenshots), opaque transition rules, `gemini-3.8-flash-tts` (`Charon`), `<= 120s` duration, and `npx hyperframes check --json` before render.
  - [ ] Container rebuild bundles offline fonts, SFX, skills, and critic agent cleanly with zero CDN runtime reliance.
- **Verification:**
  - [ ] Schema validates as strict JSON (`node -e "JSON.parse(...)"`).
  - [ ] Build succeeds: `docker build -f Dockerfile.video-worker -t ai-news-video-worker:dev .`
- **Dependencies:** Task 1, Task 2
- **Files likely touched:**
  - `video-worker/prompts/daily-briefing.md`
  - `video-worker/schemas/agy-result.schema.json`
  - `video-worker/agents/gauntlet-critic.md`
  - `Dockerfile.video-worker`
- **Estimated scope:** M (4 files)

#### Task 4: Deterministic Worker Runner & `entrypoint.ts`
- **Description:** Build `src/lib/video/worker-runner.ts` and `video-worker/entrypoint.ts` behind dependency-injected adapters (`digestRepo`, `agy`, `media`, `storage`, `videoRepo`): fetch category digest, run `agy -p --print-timeout 600s`, enforce hard technical invariants (`ffprobe` streams, `durationSec <= 120`), apply `ffmpeg loudnorm=I=-16:TP=-1:LRA=11` + poster frame capture, upload to GCS, save `ready` doc even when `criticVerdict === "NEEDS_REVIEW"`, and clean up `/tmp/job-*`.
- **Acceptance criteria:**
  - [ ] Fails cleanly without overwriting previous `ready` video if `agy -p` exits non-zero, MP4 is missing/corrupt, or `durationSec > 120`.
  - [ ] Publishes successfully with `criticVerdict: "NEEDS_REVIEW"` when technical checks pass after max critic rounds.
  - [ ] Temp directory cleanup executes in `finally` regardless of pass/fail.
- **Verification:**
  - [ ] Tests pass: `npx vitest run src/lib/video/__tests__/worker-runner.test.ts`
  - [ ] Check passes: `npm run check && npm run lint`
  - [ ] Manual check: local dry-run `VIDEO_LOCAL_OUT=./tv/dry-run` verifies CLI parsing & brief staging.
- **Dependencies:** Task 2, Task 3
- **Files likely touched:**
  - `src/lib/video/worker-runner.ts`
  - `video-worker/entrypoint.ts`
  - `src/lib/video/__tests__/worker-runner.test.ts`
  - `package.json` (add `video:run` script & `@google-cloud/storage` if approved)
- **Estimated scope:** M (4 files)

#### Task 5: Cloud Run Job Launcher & `/api/cron/video` Endpoint
- **Description:** Implement `src/lib/video/cloud-run-jobs.ts` (triggering `ai-news-video-worker` via Cloud Run Admin API v2 with `taskCount: 6` and optional `scope` / `date` overrides) and expose `POST /api/cron/video` secured by `CRON_SECRET` (`Bearer` / `x-cron-secret`, mirroring `src/app/api/cron/digest/route.ts`).
- **Acceptance criteria:**
  - [ ] Missing/invalid `CRON_SECRET` returns `401`.
  - [ ] Valid request dispatches `taskCount: 6` execution to Cloud Run Jobs and returns `{ ok: true, executionName, categories }`.
  - [ ] Unit tests mock Cloud Run Jobs API calls cleanly offline.
- **Verification:**
  - [ ] Tests pass: `npx vitest run src/lib/video/__tests__/cron-video.test.ts`
  - [ ] Check passes: `npm run check && npm run lint`
- **Dependencies:** Task 2, Task 4
- **Files likely touched:**
  - `src/lib/video/cloud-run-jobs.ts`
  - `src/app/api/cron/video/route.ts`
  - `src/lib/video/__tests__/cron-video.test.ts`
- **Estimated scope:** M (3 files)

#### Checkpoint: Worker Pipeline
- [ ] All worker & cron unit tests pass cleanly
- [ ] `npm run preflight` passes with 0 errors

---

### Phase 3: Server-Signed URLs, Cartouche UI & GCP Rollout

#### Task 6: Private GCS V4 Signer & Read API Routes (`/api/videos/latest` + `/api/videos/[id]/url`)
- **Description:** Implement injectable `@google-cloud/storage` V4 URL signer (`src/lib/video/gcs-signer.ts`, using Service Account IAM `signBlob` on Cloud Run without key files, TTL `3600s`) and Next.js routes returning latest `ready` metadata (`GET /api/videos/latest`) and fresh signed playback/poster URLs (`GET /api/videos/[id]/url`).
- **Acceptance criteria:**
  - [ ] `/api/videos/latest?scope=daily&category=<cat>` returns `404` (clean empty signal) when no `ready` video exists, or metadata + `criticVerdict`.
  - [ ] `/api/videos/[id]/url` validates doc exists and returns short-lived signed `videoUrl` + `posterUrl` (`expiresAt` <= 1h).
  - [ ] Unit tests verify signed-URL minting parameters and missing-doc handling cleanly offline.
- **Verification:**
  - [ ] Tests pass: `npx vitest run src/lib/video/__tests__/gcs-signer.test.ts`
  - [ ] Check passes: `npm run check && npm run lint`
- **Dependencies:** Task 2
- **Files likely touched:**
  - `src/lib/video/gcs-signer.ts`
  - `src/app/api/videos/latest/route.ts`
  - `src/app/api/videos/[id]/url/route.ts`
  - `src/lib/video/__tests__/gcs-signer.test.ts`
- **Estimated scope:** M (4 files)

#### Task 7: Human Feedback Route & Daily Digest Cartouche Player (`daily-digest.tsx`)
- **Description:** Add `POST /api/videos/[id]/feedback` storing `{ rating, note }` in Firestore `digest_videos`, build `src/components/digest-video-player.tsx` (poster preview, expandable `16:9` `<video controls>`, duration/critic badge, thumbs up/down + optional note UI), and integrate it inside [src/components/daily-digest.tsx](file:///Users/mblanc/projects/ai-news-front/src/components/daily-digest.tsx) when a `ready` video exists for the active category/scope.
- **Acceptance criteria:**
  - [ ] Switching category tabs updates or hides the cartouche video cleanly with zero layout flash when unavailable.
  - [ ] Clicking play / expanding fetches a fresh signed URL from `/api/videos/[id]/url`; never renders empty placeholder if `404`.
  - [ ] Human feedback validates `rating` (`"up" | "down"`), bounds `note` length, and persists to Firestore.
- **Verification:**
  - [ ] Tests pass: `npx vitest run src/lib/video/__tests__/feedback-route.test.ts`
  - [ ] Build & check pass: `npm run check && npm run lint && npm run build`
  - [ ] Browser verification via Chrome DevTools MCP (`http://localhost:3000`) checking light/dark mode & empty vs. ready cartouche states.
- **Dependencies:** Task 6
- **Files likely touched:**
  - `src/app/api/videos/[id]/feedback/route.ts`
  - `src/components/digest-video-player.tsx`
  - `src/components/daily-digest.tsx`
  - `src/lib/video/__tests__/feedback-route.test.ts`
- **Estimated scope:** M (4 files)

#### Task 8: GCP Provisioning, Daily `09:00 Europe/Paris` Scheduler & Live E2E Smoke Run
- **Description:** Configure private GCS bucket + lifecycle rule (`VIDEO_GCS_BUCKET`), IAM roles (`roles/iam.serviceAccountTokenCreator` on web SA for `signBlob`, `roles/run.developer`, `roles/aiplatform.user`, `roles/datastore.user`, `roles/storage.objectAdmin` on worker SA), deploy `ai-news-video-worker` Cloud Run Job, add Cloud Scheduler job `ai-news-video-daily` (`0 9 * * *` `Europe/Paris`), and execute a single live `CLOUD_RUN_TASK_INDEX=0` smoke run verifying end-to-end playback in the app.
- **Acceptance criteria:**
  - [ ] Private GCS bucket denies anonymous `curl` access while signed URL plays cleanly in browser.
  - [ ] Cloud Scheduler `ai-news-video-daily` configured for `0 9 * * *` (`Europe/Paris`) calling `/api/cron/video`.
  - [ ] Live Task 0 (`State of AI`) completes end-to-end (`<= 120s`, `-16 LUFS ± 2 LU`) and appears in Daily Digest cartouche.
- **Verification:**
  - [ ] CLI check: `gcloud scheduler jobs describe ai-news-video-daily --project=svc-demo-vertex --location=us-central1`
  - [ ] Manual check: execute 1 task cleanly and verify signed URL playback + feedback persistence in app.
- **Dependencies:** Task 5, Task 7
- **Files likely touched:**
  - `env.example` (document `VIDEO_GCS_BUCKET`, `VIDEO_WORKER_JOB_NAME`)
  - `docs/specs/0002-agentic-digest-video-pipeline.md` (update status -> Implemented)
- **Estimated scope:** S (2 repo files + GCP config)

#### Checkpoint: Complete
- [ ] `npm run preflight` passes (`format`, `check`, `lint`, `test`)
- [ ] Production web build (`npm run build`) succeeds
- [ ] Live Task 0 verified in GCP + Daily Digest cartouche

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **`agy -p` headless auth requires interactive OAuth token instead of pure Service Account ADC on Linux** | High (blocks unattended Cloud Run Job) | Run **Task 1 Milestone 0** container auth check immediately before Tasks 3–5; fall back to mounting Secret Manager OAuth creds into `~/.gemini/` if needed. |
| **Vertex `gemini-3.8-flash-tts` / Gemini quota spikes when 6 tasks run simultaneously at 09:00 Paris** | Medium (HTTP 429 on concurrent TTS/LLM calls) | Configure retry/backoff inside TTS calls and cap Cloud Run Job `maxRetries: 1` or `--parallelism=3` across `tasks=6` if 429s occur. |
| **Cloud Run IAM `signBlob` permission missing on Next.js SA breaks signed URLs** | Medium (video fails to load in cartouche) | Explicit Task 8 IAM verification granting `roles/iam.serviceAccountTokenCreator` to web SA on itself + Task 6 unit tests. |
| **Category digest has fewer insights or no scraped charts on quiet news days** | Low (thin scenes or >120s risk) | Enforce adaptive timing (2–5 scenes based on insight count) + deterministic `durationSec <= 120` guard in `worker-runner.ts`. |
