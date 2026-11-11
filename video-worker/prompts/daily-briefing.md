# Daily AI Digest Video Director — Canonical Cross-Digest Staged Gauntlet

Build a **115–175 second (strictly `<= 180s` / 3 minutes max, `1920×1080`, `30 fps`)** Swiss-design, minimalistic canonical AI news explainer movie inside the target output directory using HyperFrames (`hyperframes`), Vertex AI `gemini-3.8-flash-tts` (`node /app/video-worker/scripts/vertex-tts.mjs`), and `ffmpeg`.

`./input/digest.json` contains **all deduplicated daily stories across every AI category** (`State of AI`, `Frontier R&D`, `AI Engineering`, `GenMedia`, `Ecosystem`, and `Industry`), already enriched with:

- `candidateMedia`: pre-downloaded real images/charts from the source articles in `${targetOutputDir}/assets/media/story-*.{png,jpg,webp,svg}` (`kind: "chart_or_diagram" | "editorial_image"`, `caption`, `localPath`)
- `logos`: pre-downloaded official company/product brand marks in `${targetOutputDir}/assets/logos/*.{svg,png}` (`name`, `localPath`)
- `categories`, complementary `perspectives`, and `sources`.

Synthesize ALL distinct stories cleanly with **zero story repetition**, combining **data/graphs (top priority)**, **curated real article imagery**, and **official company/product logos**, synced cleanly to the generated voiceover.

## 1. The Quality Bar, Visual Hierarchy & Objective Checks

The quality bar is **Google Material 3 Motion (`m3.material.io`) + Google DeepMind Editorial (`deepmind.google`)**, grounded in `/app/DESIGN.md` tokens (`#F8F9FA` / `#FFFFFF` Light canvas, `#1A1C1E` primary ink, `#0B57D0` / `#1473F2` primary accent, `#D3E3FD` active pill, `#44474F` secondary ink, `#121417` Dark surface / `#70C4F8` accent, `Plus Jakarta Sans` + `JetBrains Mono` from `assets/fonts/`).

Reference screenshots are pre-staged inside `references/ref-*.png` (`ref-deepmind-hero.png`, `ref-deepmind-editorial.png`, `ref-m3-motion.png`) alongside `assets/fonts/`, `assets/sfx/`, `assets/media/`, `assets/logos/`, and `hyperframes.json` in your target output directory. Starter templates: `/app/video-worker/template/master-example.html` and `/app/video-worker/template/scene-example.html`.

**Editorial Visual Hierarchy (You Are the Visual Judge)**:

1. **Priority 1 — Data & Graphs Always Anchor Every Story Slide**: Every story chapter must foreground concrete quantitative evidence — either a crisp, legible real chart/diagram from `assets/media/` (`kind: "chart_or_diagram"`) OR a bespoke animated inline SVG chart/diagram (`>= 18px` labels) built from the story's verified metrics.
2. **Priority 2 — Pair Relevant Article Images Alongside Data**: Inspect the pre-downloaded `candidateMedia` files in `assets/media/` using `view_file`. Whenever a candidate image genuinely illustrates the story (a benchmark figure, architecture diagram, product UI screenshot, robot/hardware photo, or crisp editorial figure — **rejecting** blurry thumbnails, generic stock filler, broken crops, or pure text-title social cards), display it **alongside** your SVG chart or KPI metric cards inside a framed Swiss card (`background: #FFFFFF`, `border: 1.5px solid #DADCE0`, `border-radius: 18px`, `overflow: hidden`, `object-fit: contain` for charts/UI or clean `object-fit: cover` for photos). Always reference relative to project root: `src="assets/media/..."` (never `../assets/...`).
3. **Official Company / Product Logos on Slides**: Every story slide (`02`..`09`) MUST display the official local brand logo badge(s) (`<img src="assets/logos/..." />`, e.g. `22–28px` height with `object-fit: contain` inside a clean `#FFFFFF` pill or card header beside the company/product name). Never hand-draw brand logos in inline SVG; if an important company logo is missing from `assets/logos/`, you may optionally resolve it once in Stage A via `npx hyperframes media-use resolve --type logo --entity <slug> --intent "<Brand> logo" --project <targetOutputDir>` and copy it into `assets/logos/`.

Objective checks:

- **Zero Story Repetition**: Every named company, model, paper, product, or news event (`Anthropic IPO`, `AlphaProof Code`, `Gemini Robotics 2.5`, `Nvidia probe`, `ComfyUI / MiniMax H3`, `Meta Muse Ember`, `Runway Praxis-1`, `ElevenLabs`, etc.) appears in **AT MOST ONE chapter** across the entire film.
- **Source & Media Manifest**: `sources-manifest.json` lists every chapter's covered stories, source URLs, verified numbers/facts, embedded `assets/media/...` path(s) (if approved by your visual triage), embedded `assets/logos/...` path(s), and inline SVG chart type.
- **Contract & Safe Zones**: `hyperframes check --json` passes with `errorCount === 0` and `warningCount === 0` (elements inside 90% action-safe / 80% title-safe boxes, zero broken `<img>` tags, deterministic GSAP timeline, no `.clip` / `[data-start]` direct tweens, opaque `.scene-slot` slide pushes, 100% ink contrast on active vs. resting cards).
- **Audio & Timing**: Batch Vertex TTS (`Charon`) covers all chapters at a crisp anchor pace (~250–365 words total across all scenes), keeping **every VO end >= 0.45s before its transition** and total film duration strictly **`<= 180s` (target `125–172s`)**.

## 2. Staged Execution & Speed Discipline (4 Stages)

As **Gauntlet Orchestrator**, delegate HTML authoring to `scene-builder` subagents and visual inspection to fresh-context `gauntlet-critic` subagents (`invoke_subagent`) without stalling Chromium:

1. **Stage A — Visual Triage of Harvested Media, Logos & Source Facts (Sequential, fast)**:
   - Read `./input/digest.json` and inspect the pre-downloaded `assets/media/story-*` candidates using `view_file` to judge which images are high-value charts/diagrams/product/hardware visuals worth featuring vs. low-signal social banners to skip.
   - Optionally fetch up to 4 source URLs (`4s` timeout, **never** Chromium) only if extra benchmark numbers are needed beyond `digest.json` + `perspectives`.
   - Write `sources-manifest.json` inside the target output directory recording each planned chapter's approved `mediaPaths` (`assets/media/...`), `logoPaths` (`assets/logos/...`), and quantitative chart data.

2. **Stage B — Deduplicated Chapter Plan, Batch TTS, Compact `SPEC.md` & `index.html` (Sequential)**:
   - Organize all distinct stories from `./input/digest.json` into **7 to 10 crisp chapters** (`01-intro` + **6 to 9 focused story/theme chapters**, `~14–19s` per chapter, target `125–172s`, **strictly `<= 180s` total**) with **zero entity/story repetition across chapters**.
   - Keep each chapter's voiceover concise (`~28–42 words` per chapter, `~250–365 words` total).
   - Write `scenes-tts.json` (`[{ "text": "...", "out": "assets/audio/scene-01.wav" }, ...]`) and run ONE batch command:
     `node /app/video-worker/scripts/vertex-tts.mjs --batch scenes-tts.json`
   - Verify from the batch JSON output that total duration (`voDur + 1.0s` buffer per scene) is **`<= 176s`**; trim & re-synthesize any over-long clip if needed.
   - Keep `SPEC.md` **compact (`<= 50` lines)**: scene table (`id`, `src`, `start`, `duration`, `voStart`, `voDur`), exact `assets/logos/...` paths, approved `assets/media/...` path (if selected), and primary data/graph assignment per scene.
   - Write `index.html` matching `/app/video-worker/template/master-example.html` and generate stub files cleanly in one short shell command (`write_file` `index.html` only).

3. **Stage C — Parallel Scene Builders + Shared Snapshot + Fresh Critic Loop**:
   - Define `scene-builder` (`define_subagent` with `EnableWriteTools: true`) with AM3 tokens, `@font-face` paths (`assets/fonts/...`), `100%` text contrast, official brand logo pill (`<img src="assets/logos/..." />`), framed `assets/media/...` card + crisp inline SVG data chart (`>= 18px` labels) when paired, and `/app/video-worker/template/scene-example.html` pattern. Remind builders that `<img src="assets/...">` is always relative to the project root (never `../assets/...`).
   - **Author in parallel (`Model: "flash"`)**: Invoke one `scene-builder` per scene (`Model: "flash"`) in parallel to write **ONLY** its `compositions/0X-*.html` file (`90–155` lines). **Important:** Do NOT run `hyperframes check` or `hyperframes snapshot` inside parallel builders (avoids competing Chromium processes!).
   - **Single Shared Check + Snapshot**: Once all builders finish, run **one** `hyperframes check --json` (fixing any lint errors via targeted builder call) and **one** `hyperframes snapshot --at <1–2 mid-beat timestamps per scene, <= 16 timestamps total> --no-end -o snapshots/round-1/`.
   - **Fresh Critics (`invoke_subagent`, TypeName `gauntlet-critic`)**: Invoke `gauntlet-critic` subagents inspecting ONLY the captured PNGs from `snapshots/round-1/` side-by-side with `references/ref-*.png` (no builder CoT!). Log verdicts & `SINGLE LARGEST GAP` in `GAUNTLET_PROGRESS.md`.
   - For any scene judged `REFERENCE WINS`, send ONLY the critic's `SINGLE LARGEST GAP` + timestamp back to `scene-builder` (`Model: "flash"`), re-run **one** `hyperframes snapshot` over those scenes, and re-critique (up to **max 2 fix rounds**; shift layout strategy or drop an ill-fitting raster image in favor of a cleaner SVG data chart if an image crop/aspect gap repeats).

4. **Stage D — Integration Check, Render & Strict JSON Return (Sequential)**:
   - Run `hyperframes check --json` (`errorCount === 0`, `warningCount === 0`) and spawn one fresh `gauntlet-critic` integration pass over transition snapshots (`snapshots/final/` or round contact sheet) + `sources-manifest.json` consistency. Fix major transition defects if any.
   - Render `raw.mp4` via `hyperframes render --quality standard --output raw.mp4`.
   - Set `criticVerdict: "OURS WINS"` if critic passes, else `"NEEDS_REVIEW"` with concise actionable `criticNotes`.
   - Return ONLY valid JSON matching `/app/video-worker/schemas/agy-result.schema.json`.
