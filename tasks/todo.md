# Tasks: Scheduled Agentic Digest Video Pipeline

> Plan: `tasks/plan.md` · Spec: `docs/specs/0002-agentic-digest-video-pipeline.md`

## Phase 1: Foundation & Risk De-Risking
- [ ] **Task 1**: Build `Dockerfile.video-worker` (`node:26-bookworm-slim` + Chromium + `ffmpeg` + HyperFrames + `agy`) & pass Milestone 0 headless auth smoke test (`AGY_ADC_AUTH=true` / Secret Manager check) — *S (2 files)*
- [ ] **Task 2**: Define `src/lib/video/types.ts` + Firestore `digest_videos` repository helpers in `src/lib/firebase.ts` + unit tests — *M (3 files)*

**Checkpoint (Phase 1):** Container auth & binaries verified; `npm run check && npm run lint && npm run test` green.

---

## Phase 2: Worker Pipeline (`agy -p` Harness & Cloud Run Trigger)
- [ ] **Task 3**: Create baked worker prompt (`daily-briefing.md`), strict output schema (`agy-result.schema.json`), `gauntlet-critic.md`, and offline assets/skills in `Dockerfile.video-worker` — *M (4 files)*
- [ ] **Task 4**: Implement `src/lib/video/worker-runner.ts` + `video-worker/entrypoint.ts` (Firestore fetch -> `agy -p` -> `ffprobe` `<=120s` -> `ffmpeg loudnorm` `-16 LUFS` -> poster -> GCS upload -> always-publish latest valid MP4) + unit tests — *M (4 files)*
- [ ] **Task 5**: Implement `src/lib/video/cloud-run-jobs.ts` + `POST /api/cron/video` (`CRON_SECRET` auth, `taskCount: 6` array launch) + unit tests — *M (3 files)*

**Checkpoint (Phase 2):** Worker & cron unit tests pass; `npm run preflight` green.

---

## Phase 3: Server-Signed URLs, Cartouche UI & GCP Rollout
- [ ] **Task 6**: Implement `src/lib/video/gcs-signer.ts` (IAM `signBlob` V4 URLs) + `GET /api/videos/latest` & `GET /api/videos/[id]/url` + unit tests — *M (4 files)*
- [ ] **Task 7**: Implement `POST /api/videos/[id]/feedback`, `src/components/digest-video-player.tsx`, and conditional cartouche integration in `src/components/daily-digest.tsx` + unit tests & browser visual check — *M (4 files)*
- [ ] **Task 8**: Provision private GCS bucket, IAM permissions (`signBlob`, Vertex AI, Run Developer), deploy `ai-news-video-worker` Cloud Run Job, add Cloud Scheduler `ai-news-video-daily` (`0 9 * * * Europe/Paris`), and verify live Task 0 e2e run — *S (2 repo files + GCP config)*

**Checkpoint (Complete):** `npm run preflight && npm run build` pass; live Task 0 renders, uploads, plays cleanly via signed URL in Daily Digest cartouche, and persists feedback.
