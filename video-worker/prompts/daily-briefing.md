# Daily AI Digest Video Director — Canonical Cross-Digest Staged Gauntlet

Build a **115–175 second (strictly `<= 180s` / 3 minutes max, `1920×1080`, `30 fps`)** Swiss-design, minimalistic canonical AI news explainer movie inside the target output directory using HyperFrames (`hyperframes`), Vertex AI `gemini-3.8-flash-tts` (`node /app/video-worker/scripts/vertex-tts.mjs`), and `ffmpeg`. `./input/digest.json` contains **all deduplicated daily stories across every AI category** (`State of AI`, `Frontier R&D`, `AI Engineering`, `GenMedia`, `Ecosystem`, and `Industry`), including each story's `categories`, complementary `perspectives`, and `sources`. Synthesize ALL distinct stories cleanly with **zero story repetition**, grounded in real fetched source facts/media/charts and synced cleanly to the generated voiceover.

## 1. The Quality Bar & Objective Checks

The quality bar is **Google Material 3 Motion (`m3.material.io`) + Google DeepMind Editorial (`deepmind.google`)**, grounded in `/app/DESIGN.md` tokens (`#F8F9FA` / `#FFFFFF` Light canvas, `#1A1C1E` primary ink, `#0B57D0` / `#1473F2` primary accent, `#D3E3FD` active pill, `#44474F` secondary ink, `#121417` Dark surface / `#70C4F8` accent, `Plus Jakarta Sans` + `JetBrains Mono` from `assets/fonts/`).

Reference screenshots are pre-staged inside `references/ref-*.png` (`ref-deepmind-hero.png`, `ref-deepmind-editorial.png`, `ref-m3-motion.png`) alongside `assets/fonts/`, `assets/sfx/`, and `hyperframes.json` in your target output directory. Starter templates: `/app/video-worker/template/master-example.html` and `/app/video-worker/template/scene-example.html`.

Objective checks:

- **Zero Story Repetition**: Every named company, model, paper, product, or news event (`Anthropic IPO`, `AlphaProof Code`, `Gemini Robotics 2.5`, `Nvidia probe`, `ComfyUI / MiniMax H3`, `Meta Muse Ember`, `Runway Praxis-1`, `ElevenLabs`, etc.) appears in **AT MOST ONE chapter** across the entire film. If two items in `./input/digest.json` touch the same entity or theme, synthesize them once in a single chapter and never mention them again in later scenes.
- **Source & Media Manifest**: `sources-manifest.json` lists every chapter's covered stories, source URLs, verified numbers/facts, and any downloaded crisp high-res local asset path (`naturalWidth > 0`) or crisp inline SVG diagram (`>= 18px` labels).
- **Contract & Safe Zones**: `hyperframes check --json` passes with `errorCount === 0` and `warningCount === 0` (elements inside 90% action-safe / 80% title-safe boxes, deterministic GSAP timeline, no `.clip` / `[data-start]` direct tweens, opaque `.scene-slot` slide pushes, 100% ink contrast on active vs. resting cards).
- **Audio & Timing**: Batch Vertex TTS (`Charon`) covers all chapters at a crisp anchor pace (~250–365 words total across all scenes), keeping **every VO end >= 0.45s before its transition** and total film duration strictly **`<= 180s` (target `125–172s`)**.

## 2. Staged Execution & Speed Discipline (4 Stages)

As **Gauntlet Orchestrator**, delegate HTML authoring to `scene-builder` subagents and visual inspection to fresh-context `gauntlet-critic` subagents (`invoke_subagent`) without stalling Chromium:

1. **Stage A — Research & Asset Ingestion (Sequential, fast)**:
   - Read `./input/digest.json` and run ONE bounded Node script fetching up to 6 primary source URLs in parallel (`4s` AbortSignal timeout per URL — **never** launch Chromium to scrape websites; fall back to `digest.json` + `perspectives` if slow/blocked).
   - Optionally download crisp high-res media into `assets/media/` (or redraw data natively as crisp inline SVG `>= 18px` labels).
   - Write compact `sources-manifest.json` inside the target output directory.

2. **Stage B — Deduplicated Chapter Plan, Batch TTS, Compact `SPEC.md` & `index.html` (Sequential)**:
   - Organize all distinct stories from `./input/digest.json` into **7 to 10 crisp chapters** (`01-intro` + **6 to 9 focused story/theme chapters**, `~14–19s` per chapter, target `125–172s`, **strictly `<= 180s` total**). Give major cross-category stories their own dedicated chapter and group closely related minor updates into clean thematic chapters (e.g., Local Runtime & Edge Stack, Generative Media & World Models) — **strictly enforcing that no entity/story is mentioned in more than one chapter**.
   - Keep each chapter's voiceover concise (`~28–42 words` per chapter, `~250–365 words` total) so total audio + padding stays comfortably under `175s`.
   - Write `scenes-tts.json` (`[{ "text": "...", "out": "assets/audio/scene-01.wav" }, ...]`) and run ONE batch command:
     `node /app/video-worker/scripts/vertex-tts.mjs --batch scenes-tts.json`
   - Verify from the batch JSON output that the sum of scene durations (`voDur + 1.0s` buffer per scene) is **`<= 176s`**; if over `176s`, trim the longest 1–2 scripts and re-synthesize only those clips before proceeding.
   - Keep `SPEC.md` **compact (`<= 45` lines)**: only scene table (`id`, `src`, `start`, `duration`, `voStart`, `voDur`), category badge, Swiss grid layout & SVG/visual assignment per scene.
   - Write `index.html` matching `/app/video-worker/template/master-example.html` and generate stub files cleanly in one short shell command (`write_file` `index.html` only).

3. **Stage C — Parallel Scene Builders + Shared Snapshot + Fresh Critic Loop**:
   - Define `scene-builder` (`define_subagent` with `EnableWriteTools: true`) with AM3 tokens, `@font-face` paths (`assets/fonts/...`), `100%` text contrast, category pill badge (e.g. `FRONTIER R&D`, `AI ENGINEERING`, `GENMEDIA`, `INDUSTRY`), and `/app/video-worker/template/scene-example.html` pattern.
   - **Author in parallel (`Model: "flash"`)**: Invoke one `scene-builder` per scene (`Model: "flash"`) in parallel to write **ONLY** its `compositions/0X-*.html` file (`80–140` lines). **Important:** Do NOT run `hyperframes check` or `hyperframes snapshot` inside parallel builders (avoids competing Chromium processes!).
   - **Single Shared Check + Snapshot**: Once all builders finish, run **one** `hyperframes check --json` (fixing any lint errors via targeted builder call) and **one** `hyperframes snapshot --at <1–2 mid-beat timestamps per scene, <= 16 timestamps total> --no-end -o snapshots/round-1/`.
   - **Fresh Critics (`invoke_subagent`, TypeName `gauntlet-critic`)**: Invoke `gauntlet-critic` subagents inspecting ONLY the captured PNGs from `snapshots/round-1/` side-by-side with `references/ref-*.png` (no builder CoT!). Log verdicts & `SINGLE LARGEST GAP` in `GAUNTLET_PROGRESS.md`.
   - For any scene judged `REFERENCE WINS`, send ONLY the critic's `SINGLE LARGEST GAP` + timestamp back to `scene-builder` (`Model: "flash"`), re-run **one** `hyperframes snapshot` over those scenes, and re-critique (up to **max 2 fix rounds**; shift layout strategy if the exact same gap repeats twice).

4. **Stage D — Integration Check, Render & Strict JSON Return (Sequential)**:
   - Run `hyperframes check --json` (`errorCount === 0`, `warningCount === 0`) and spawn one fresh `gauntlet-critic` integration pass over transition snapshots (`snapshots/final/` or round contact sheet) + `sources-manifest.json` consistency. Fix major transition defects if any.
   - Render `raw.mp4` via `hyperframes render --quality standard --output raw.mp4`.
   - Set `criticVerdict: "OURS WINS"` if critic passes, else `"NEEDS_REVIEW"` with concise actionable `criticNotes`.
   - Return ONLY valid JSON matching `/app/video-worker/schemas/agy-result.schema.json`.
