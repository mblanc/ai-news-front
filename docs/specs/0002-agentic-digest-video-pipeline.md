# Spec: Scheduled Agentic Digest Video Creation Pipeline (Google Cloud)

**Status**: Updated with Decisions — Ready for Review & `/plan` Approval  
**Date**: November 10, 2026  
**Location**: `docs/specs/0002-agentic-digest-video-pipeline.md`

---

## Locked-In Design Decisions

1. **Harness**: **Antigravity Headless CLI (`agy -p`)** running inside a Debian Cloud Run Job container, sharing the same skills, `DESIGN.md`, and `gauntlet-critic` blind visual review workflow verified locally.
2. **Scope**: **All 6 daily digest categories** (`all` [State of AI], `ai-engineering`, `frontier-research`, `genmedia`, `ecosystem-analysis`, `industry-news`), fan-out across **6 isolated Cloud Run Job array tasks** (`tasks=6`, mapped via `CLOUD_RUN_TASK_INDEX`) so all 6 movies render in parallel in ~6–8 minutes with independent retries and failure isolation.
3. **Schedule**: **Once per day at `09:00 Europe/Paris`** (`0 9 * * *` `Europe/Paris`) triggered via Cloud Scheduler → `POST /api/cron/video` (secured with `CRON_SECRET` + OIDC), operating on the latest daily digest docs already persisted in Firestore (most recently refreshed at `08:02 Paris` / `07:02Z` by `ai-news-ingest-hourly`).
4. **Media Access**: **Private GCS bucket + Server-Signed URLs** minted by the Next.js backend (`@google-cloud/storage` via Cloud Run Service Account IAM `signBlob`, short TTL e.g. `1 hour`, zero public bucket objects).
5. **Quality Gate & Human Feedback**: After `maxCriticRounds = 3`, **always publish the latest rendered candidate** as long as deterministic technical invariants pass (valid H.264/AAC MP4, `ffprobe` verified, `durationSec <= 120`), storing `criticVerdict`, `criticNotes`, and an inline UI human-feedback hook (`POST /api/videos/[id]/feedback`) so humans can review flagged outputs.

---

## Assumptions

1. **Artifact Packaging**: Each category run produces `briefing.mp4` (`1920×1080`, `30 fps`, `-16 LUFS ± 2 LU`), `poster.jpg`, and `manifest.json` (plus snapshots/critic notes for auditability).
2. **Container Base**: `node:26-bookworm-slim` (instead of Alpine) because `hyperframes` and headless Chromium require glibc.
3. **IAM & Auth**:
   - Web service SA (`ai-news-front`) gets `roles/run.developer` (execute video worker job), `roles/storage.objectViewer`, and `roles/iam.serviceAccountTokenCreator` (self-signing GCS V4 signed URLs without private JSON key files).
   - Video worker SA (`ai-news-video-worker`) gets `roles/aiplatform.user` (`gemini-3.8-flash-tts`), `roles/discoveryengine.agentspaceUser` (`AGY_ADC_AUTH=true` enterprise quota), `roles/datastore.user` (Firestore read/write), and `roles/storage.objectAdmin` (GCS upload).
   - `agy -p` headless auth uses `AGY_ADC_AUTH=true`, `GOOGLE_CLOUD_QUOTA_PROJECT`, `GOOGLE_CLOUD_LOCATION=global`, `--model gemini-3.8-flash-medium`, and `--dangerously-skip-permissions` (verified live on Cloud Run Jobs in `16m 25s`; no `--mode auto`).
4. **Lifecycle Retention**: GCS objects use a bucket lifecycle rule (e.g., 30–90 days auto-delete, configurable) matched with Firestore `TTL_DAYS` pointers.

---

## Objective

Automate the daily `09:00 Europe/Paris` generation of 6 bespoke, publication-grade AI news briefing videos (1 per category) using the **Antigravity Headless CLI (`agy -p`)** on **Cloud Run Jobs**, serving authenticated playback in the Next.js web app via server-signed GCS URLs and capturing critic + human feedback metadata in Firestore.

### User Stories

1. **As a daily reader**, I want a ~60–95s narrated Swiss/Material 3 video briefing available for every category tab (`State of AI`, `AI Engineering`, `Frontier R&D`, `GenMedia`, `Ecosystem Analysis`, `Industry News`), delivered via secure signed playback URLs.
2. **As a platform operator**, I want a single `0 9 * * * (Europe/Paris)` Cloud Scheduler trigger to spawn 6 parallel Cloud Run Job tasks (`tasks=6`), so one slow/failing category never blocks or times out the other 5.
3. **As an editorial reviewer**, I want the latest rendered candidate published even when the automated critic still notes secondary polish opportunities (`criticVerdict: "needs_review"`), alongside a lightweight human feedback control in the UI so we can iteratively refine prompts/skills.
4. **As a developer**, I want the pre/post deterministic wrappers (Firestore fetch, `agy` runner adapter, `ffprobe`/`loudnorm` validation, GCS signed URL minter, feedback API) written behind testable TypeScript interfaces with offline fakes.

---

## Tech Stack

- **Agentic Harness**: Google Antigravity CLI (`agy >= 1.4.12`) in headless print mode (`-p --mode auto --dangerously-skip-permissions --output-format json`)
- **Video Engine**: `hyperframes` CLI (`init`, `check --json`, `snapshot`, `render --quality delivery`), GSAP `3.14.x`, headless Chromium, `ffmpeg` + `ffprobe`
- **Audio / TTS**: Vertex AI `gemini-3.8-flash-tts` (`location="global"`, `"Charon"` voice) + `ffmpeg loudnorm=I=-16:TP=-1:LRA=11`
- **GCP Runtime & Storage**: Cloud Run Jobs (`4–8 vCPU`, `8 GiB RAM`, `900s` timeout per task, `tasks=6`), Cloud Scheduler (`0 9 * * * Europe/Paris`), Cloud Storage (`@google-cloud/storage`), Firestore (`@google-cloud/firestore`)
- **Web Integration**: Next.js 16 App Router API routes (`/api/cron/video`, `/api/videos/latest`, `/api/videos/[id]/url`, `/api/videos/[id]/feedback`) + inline `DigestVideoPlayer` embedded in [src/components/daily-digest.tsx](file:///Users/mblanc/projects/ai-news-front/src/components/daily-digest.tsx) cartouche

---

## Commands

```bash
# 0. Milestone 0 Auth Smoke Test inside Debian container
docker build -f Dockerfile.video-worker -t ai-news-video-worker:dev .
docker run --rm -e AGY_ADC_AUTH=true -e GOOGLE_CLOUD_QUOTA_PROJECT=svc-demo-vertex -e GOOGLE_CLOUD_LOCATION=global ai-news-video-worker:dev agy -p "Reply OK" --model gemini-3.8-flash-medium --dangerously-skip-permissions --output-format json

# 1. Local existing app checks (run after any code edits)
npm run check
npm run lint
npm run test

# 2. Local single-category worker test (matches Cloud Run Job task #0 = "all")
CLOUD_RUN_TASK_INDEX=0 DIGEST_ID=daily VIDEO_LOCAL_OUT=./tv/test-run node video-worker/entrypoint.ts

# 3. Inside worker: headless agy invocation executed per task
AGY_ADC_AUTH=true GOOGLE_CLOUD_QUOTA_PROJECT=svc-demo-vertex GOOGLE_CLOUD_LOCATION=global agy -p "<task prompt pointing to /tmp/job/brief.json & skills>" \
  --model gemini-3.8-flash-medium \
  --dangerously-skip-permissions \
  --print-timeout 600s \
  --output-format json \
  --json-schema /app/video-worker/schemas/agy-result.schema.json

# 4. Deterministic post-validation & loudness mastering
npx hyperframes check --json
ffmpeg -y -i raw.mp4 -c:v copy -af "loudnorm=I=-16:TP=-1:LRA=11" -c:a aac -b:a 192k briefing.mp4
ffmpeg -y -ss 5.0 -i briefing.mp4 -vframes 1 -q:v 2 poster.jpg
```

---

## Project Structure

```text
ai-news-front/
├── Dockerfile                      # Existing lightweight Next.js standalone runner (unchanged)
├── Dockerfile.video-worker         # New: node:26-bookworm-slim + agy CLI + Chromium + ffmpeg + HyperFrames + offline assets/skills
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── cron/
│   │   │   │   └── video/route.ts  # New: POST (CRON_SECRET) triggers Cloud Run Job with taskCount=6
│   │   │   └── videos/
│   │   │       ├── latest/route.ts # New: GET ready `digest_videos` metadata by scope & category
│   │   │       └── [id]/
│   │   │           ├── url/route.ts      # New: GET fresh short-lived server-signed GCS video + poster URLs
│   │   │           └── feedback/route.ts # New: POST human thumbs up/down + note into Firestore
│   │   ├── lib/
│   │   │   ├── video/
│   │   │   │   ├── types.ts            # Category slug mapping, VideoDocument, AgyResultSchema, FeedbackPayload
│   │   │   │   ├── gcs-signer.ts       # Mint time-limited V4 signed URLs via @google-cloud/storage (injectable)
│   │   │   │   ├── cloud-run-jobs.ts   # Launch Cloud Run Job execution (`tasks: 6`) via REST/Jobs client (injectable)
│   │   │   │   ├── worker-runner.ts    # Pre/post deterministic orchestrator wrapping `agy -p` subprocess
│   │   │   │   └── __tests__/          # Offline Vitest suites (auth, task-index mapping, schema guardrails, signer, fallback publish)
│   │   │   └── firebase.ts             # Extended: query/save `digest_videos` & record human feedback
│   │   └── components/
│   │       ├── daily-digest.tsx        # Extended: renders `DigestVideoPlayer` inside ready Daily digest cartouche when available
│   │       └── digest-video-player.tsx # New: 16:9 signed-URL player + poster preview + duration badge + human feedback controls
└── video-worker/
    ├── entrypoint.ts               # Maps CLOUD_RUN_TASK_INDEX (0..5) -> category, invokes worker-runner.ts
    ├── prompts/
    │   └── daily-briefing.md       # System task instructions & mandatory chart/TTS/timing/critic rules for agy -p
    ├── schemas/
    │   └── agy-result.schema.json  # Strict schema enforced via `agy --json-schema`
    ├── agents/
    │   └── gauntlet-critic.md      # Pre-baked blind A/B critic agent definition
    ├── assets/                     # Pre-baked fonts (.woff2), licensed SFX (.mp3), reference stills (ref-*.png)
    └── skills/                     # Pre-baked hyperframes* + media-use SKILL.md & references + DESIGN.md
```

---

## Code Style & Architectural Pattern

Every integration point (`CloudRunJobsClient`, `AgyRunner`, `MediaNormalizer`, `StoragePublisher`, `UrlSigner`) sits behind clean injected interfaces matching `docs/specs/0001-pipeline-architecture-refactor.md`:

```typescript
export const VIDEO_CATEGORIES = [
  "all", // TASK_INDEX=0: State of AI
  "ai-engineering", // TASK_INDEX=1
  "frontier-research", // TASK_INDEX=2
  "genmedia", // TASK_INDEX=3
  "ecosystem-analysis", // TASK_INDEX=4
  "industry-news", // TASK_INDEX=5
] as const

export async function executeWorkerTask(
  taskIndex: number,
  dateStr: string,
  deps: VideoWorkerDeps
): Promise<VideoDocument> {
  const category = VIDEO_CATEGORIES[taskIndex]
  const digest = await deps.digestRepo.getDigest("daily", category)
  const agyResult = await deps.agy.runHeadless(buildBrief(digest, category, dateStr))

  // Hard technical invariants only; publish latest version even if critic status === "needs_review"
  const { finalMp4, posterJpg, durationSec, lufs } = await deps.media.verifyAndMaster(
    agyResult.mp4Path,
    {
      maxDurationSec: 120,
      targetLufs: -16,
    }
  )

  const gcsPaths = await deps.storage.uploadArtifacts({
    dateStr,
    digestId: "daily",
    category,
    finalMp4,
    posterJpg,
  })
  return deps.videoRepo.saveReady({
    dateStr,
    digestId: "daily",
    category,
    gcsPaths,
    durationSec,
    lufs,
    criticVerdict: agyResult.criticVerdict, // "OURS WINS" | "NEEDS_REVIEW"
    criticNotes: agyResult.criticNotes,
    criticRounds: agyResult.criticRounds,
  })
}
```

### Mandatory Rules Passed to `agy -p` via `daily-briefing.md`

- Ground narration strictly in **every** insight in that category's Firestore daily digest (scraped full source paragraphs + verified images).
- Author bespoke GSAP/SVG motion graphics matching [DESIGN.md](file:///Users/mblanc/projects/ai-news-front/DESIGN.md) (`18–24px` crisp vector labels instead of small blurry raster chart screenshots; opaque transitions with zero ghosting; full ink contrast on resting/active cards).
- Use Google Cloud **`gemini-3.8-flash-tts`** (`Charon` voice, ADC auth) and keep total duration **`60–95s` (hard cap `120s`)**.
- Always pass `npx hyperframes check --json` (`errorCount === 0`) and run up to 3 `gauntlet-critic` visual review rounds (`OURS WINS` vs best-available candidate on round 3).

---

## Testing Strategy

- **Unit Tests (`vitest`)** under `src/lib/video/__tests__/`:
  - `CLOUD_RUN_TASK_INDEX` (`0..5`) mapping + out-of-range error handling.
  - `worker-runner.ts`: verifies publish succeeds when `criticVerdict === "NEEDS_REVIEW"` after max critic rounds, while rejecting when `durationSec > 120` or `mp4Path` is missing/corrupt.
  - `gcs-signer.ts`: verifies signed URL generation parameters (expiry window, content disposition, 404/401 when document missing).
  - `/api/cron/video` + `/api/videos/[id]/feedback`: verifies `CRON_SECRET` enforcement, Cloud Run Job launch payload (`taskCount: 6`), and feedback sanitization.
- **Container & End-to-End Verification**:
  - **Milestone 0 (`AGY_ADC_AUTH=true`)**: Verify headless `agy -p` authenticates cleanly inside `Dockerfile.video-worker` using Cloud Run Workload Identity / Secret Manager before building downstream layers.
  - **Live Single-Task Render**: Execute `CLOUD_RUN_TASK_INDEX=0` on GCP Cloud Run Jobs (`ai-news-video-worker --tasks=1`) and confirm GCS upload (`gs://...`), Firestore `digest_videos` write, and playable server-signed URL in the Next.js Digest UI.

---

## Firestore & GCS Data Model

- **GCS Bucket (`VIDEO_GCS_BUCKET`, private)**:
  - `videos/<YYYY-MM-DD>/daily/<category>/briefing.mp4`
  - `videos/<YYYY-MM-DD>/daily/<category>/poster.jpg`
  - `videos/<YYYY-MM-DD>/daily/<category>/manifest.json`
- **Firestore Collection `digest_videos`** (Doc ID: `<YYYY-MM-DD>_daily_<category>`):
  - `digestId`: `"daily"`, `category`, `date`: `"YYYY-MM-DD"`
  - `status`: `"rendering" | "ready" | "failed"`
  - `gcsVideoPath`, `gcsPosterPath` (never raw permanent public URLs)
  - `durationSec`, `lufs`, `generatedAt`, `headline`, `insightCount`
  - `criticVerdict`: `"OURS WINS" | "NEEDS_REVIEW"`, `criticRounds`: `number`, `criticNotes`: `string`
  - `humanFeedback`: `{ rating?: "up" | "down"; note?: string; updatedAt?: string; updatedBy?: string }[]`

---

## Boundaries

- **Always**:
  - Authenticate `POST /api/cron/video` via `CRON_SECRET` and IAM OIDC (`scheduler-invoker@svc-demo-vertex.iam.gserviceaccount.com`).
  - Keep `VIDEO_GCS_BUCKET` private; mint short-lived V4 signed URLs strictly on the server (`/api/videos/[id]/url`).
  - Pass `--print-timeout 600s` to `agy -p` inside each `900s` Cloud Run Job task so post-processing + upload always have time to complete or fail cleanly.
  - Only show the video player inside the `DailyDigest` cartouche (`src/components/daily-digest.tsx`) when `status === "ready"` for the active scope/category; never render broken players or pending placeholders for categories/scopes without a video.
  - Enforce hard technical checks (`check --json` `errorCount === 0`, valid `ffprobe` streams, `durationSec <= 120`, `loudnorm`) before uploading to GCS.
- **Ask First**:
  - Introducing IAM permission changes or Terraform/Cloud Build automation beyond this repo's standard `gcloud` deploy scripts.
  - Exposing human feedback submission to anonymous users vs. authenticated/IAP users.
- **Never**:
  - Commit credentials, OAuth refresh tokens, `.env.local`, or `CRON_SECRET`.
  - Allow Chromium rendering inside the Next.js standalone web container (`Dockerfile`).
  - Leave temp `/tmp/job-*` artifacts behind between container reuses.

---

## Success Criteria

1. **Milestone 0 Auth Gate**: `agy -p` runs unassisted inside `Dockerfile.video-worker` on Google Cloud (`linux/amd64`) using Service Account ADC (or configured Secret Manager token fallback).
2. **Schedule**: Cloud Scheduler triggers `ai-news-video-daily` at **`0 9 * * *` (`Europe/Paris`)**, spawning `6` parallel Cloud Run Job tasks covering all 6 categories in under **10 minutes** wall-clock total.
3. **Output Quality**: Each completed task produces a valid `1920×1080` `30fps` H.264/AAC MP4 (`<= 120s`, `-16 LUFS ± 2 LU`), uploads `briefing.mp4` + `poster.jpg` to private GCS, and writes `status: "ready"` (along with `criticVerdict` / `criticNotes`) to `digest_videos`.
4. **Daily Digest Cartouche UI & Feedback**: Inside [daily-digest.tsx](file:///Users/mblanc/projects/ai-news-front/src/components/daily-digest.tsx), whenever a `ready` video exists for the selected category/scope (`GET /api/videos/latest?scope=daily&category=<cat>`), the Daily digest cartouche displays an inline **Briefing Video** toggle/player (`DigestVideoPlayer`) loading fresh server-signed poster + MP4 URLs (`GET /api/videos/[id]/url`) and allowing human feedback (`POST /api/videos/[id]/feedback`) stored in Firestore; when no video exists, the cartouche layout stays clean with no empty box.
5. **Repo Health**: `npm run check && npm run lint && npm run test` pass cleanly.
