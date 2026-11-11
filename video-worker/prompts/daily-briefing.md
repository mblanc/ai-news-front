# Daily AI Digest Video Director — Pure-Prompt Staged Gauntlet

Build a 60–95 second (strictly `<= 120s`, `1920×1080`, `30 fps`) Swiss-design, minimalistic AI news explainer movie inside the target output directory using HyperFrames (`hyperframes`), Vertex AI `gemini-3.8-flash-tts` (`node /app/video-worker/scripts/vertex-tts.mjs`), and `ffmpeg`. Cover ALL insights in `./input/digest.json`, grounded in real fetched source facts/media/charts and synced cleanly to the generated voiceover.

## 1. The Quality Bar & Objective Checks

The quality bar is **Google Material 3 Motion (`m3.material.io`) + Google DeepMind Editorial (`deepmind.google`)**, grounded in `/app/DESIGN.md` tokens (`#F8F9FA` / `#FFFFFF` Light canvas, `#1A1C1E` primary ink, `#0B57D0` / `#1473F2` primary accent, `#D3E3FD` active pill, `#44474F` secondary ink, `#121417` Dark surface / `#70C4F8` accent, `Plus Jakarta Sans` + `JetBrains Mono` from `assets/fonts/`).

Reference screenshots are pre-staged inside `references/ref-*.png` (`ref-deepmind-hero.png`, `ref-deepmind-editorial.png`, `ref-m3-motion.png`) alongside `assets/fonts/`, `assets/sfx/`, and `hyperframes.json` in your target output directory. Starter templates: `/app/video-worker/template/master-example.html` and `/app/video-worker/template/scene-example.html`.

Objective checks:

- **Source & Media Manifest**: `sources-manifest.json` lists every story from `./input/digest.json`, source URL, verified numbers/facts, and any downloaded crisp high-res local asset path (`naturalWidth > 0`) or crisp inline SVG diagram (`>= 18px` labels).
- **Contract & Safe Zones**: `hyperframes check --json` passes with `errorCount === 0` and `warningCount === 0` (elements inside 90% action-safe / 80% title-safe boxes, deterministic GSAP timeline, no `.clip` / `[data-start]` direct tweens, opaque `.scene-slot` slide pushes, 100% ink contrast on active vs. resting cards).
- **Audio & Timing**: Batch Vertex TTS (`Charon`) covers all insights at natural pace (~135–190 words total), keeping **every VO end >= 0.45s before its transition** and total length `<= 120s`.

## 2. Staged Execution & Speed Discipline (4 Stages)

As **Gauntlet Orchestrator**, delegate HTML authoring to `scene-builder` subagents and visual inspection to fresh-context `gauntlet-critic` subagents (`invoke_subagent`) without stalling Chromium:

1. **Stage A — Research & Asset Ingestion (Sequential, fast)**:
   - Read `./input/digest.json` and run ONE bounded Node script fetching up to 4 source URLs in parallel (`4s` AbortSignal timeout per URL — **never** launch Chromium to scrape websites; fall back to `digest.json` if slow/blocked).
   - Optionally download crisp high-res media into `assets/media/` (or redraw data natively as crisp inline SVG `>= 18px` labels).
   - Write compact `sources-manifest.json` inside the target output directory.

2. **Stage B — Script, Batch TTS, Compact `SPEC.md` & `index.html` (Sequential)**:
   - Group ALL insights cleanly across **4 to 5 chapters** (`01-intro` + 3–4 story/analysis scenes, target `60–95s`, strictly `<= 120s`).
   - Write `scenes-tts.json` (`[{ "text": "...", "out": "assets/audio/scene-01.wav" }, ...]`) and run ONE batch command:
     `node /app/video-worker/scripts/vertex-tts.mjs --batch scenes-tts.json`
   - Keep `SPEC.md` **compact (`<= 35` lines)**: only scene table (`id`, `src`, `start`, `duration`, `voStart`, `voDur`), Swiss grid layout & SVG/visual assignment per scene.
   - Write `index.html` matching `/app/video-worker/template/master-example.html` and generate stub files cleanly in one short shell command (`write_file` `index.html` only).

3. **Stage C — Parallel Scene Builders + Shared Snapshot + Fresh Critic Loop**:
   - Define `scene-builder` (`define_subagent` with `EnableWriteTools: true`) with AM3 tokens, `@font-face` paths (`assets/fonts/...`), `100%` text contrast, and `/app/video-worker/template/scene-example.html` pattern.
   - **Author in parallel (`Model: "flash"`)**: Invoke one `scene-builder` per scene (`Model: "flash"`) to write **ONLY** its `compositions/0X-*.html` file (`80–140` lines). **Important:** Do NOT run `hyperframes check` or `hyperframes snapshot` inside parallel builders (avoids 5 competing Chromium processes!).
   - **Single Shared Check + Snapshot**: Once all builders finish, run **one** `hyperframes check --json` (fixing any lint errors via targeted builder call) and **one** `hyperframes snapshot --at <timestamps spanning 2 key beats per scene> --no-end -o snapshots/round-1/`.
   - **Fresh Critics (`invoke_subagent`, TypeName `gauntlet-critic`)**: Invoke `gauntlet-critic` subagents inspecting ONLY the captured PNGs from `snapshots/round-1/` side-by-side with `references/ref-*.png` (no builder CoT!). Log verdicts & `SINGLE LARGEST GAP` in `GAUNTLET_PROGRESS.md`.
   - For any scene judged `REFERENCE WINS`, send ONLY the critic's `SINGLE LARGEST GAP` + timestamp back to `scene-builder` (`Model: "flash"`), re-run **one** `hyperframes snapshot` over those scenes, and re-critique (up to **max 2 fix rounds**; shift layout strategy if the exact same gap repeats twice).

4. **Stage D — Integration Check, Render & Strict JSON Return (Sequential)**:
   - Run `hyperframes check --json` (`errorCount === 0`, `warningCount === 0`) and spawn one fresh `gauntlet-critic` integration pass over transition snapshots (`snapshots/final/` or round contact sheet) + `sources-manifest.json` consistency. Fix major transition defects if any.
   - Render `raw.mp4` via `hyperframes render --quality standard --output raw.mp4`.
   - Set `criticVerdict: "OURS WINS"` if critic passes, else `"NEEDS_REVIEW"` with concise actionable `criticNotes`.
   - Return ONLY valid JSON matching `/app/video-worker/schemas/agy-result.schema.json`.
