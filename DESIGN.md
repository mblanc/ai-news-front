# Design System: Agentic Material 3 (AM3)

## 1. Visual Theme & Atmosphere

The **Agentic Material 3 (AM3)** design system is an expressive, next-generation design language and generative UI framework developed by Google Applied Moonshots for AI agents, intelligence dashboards, and conversational workspaces.

AM3 evolves classical Material Design 3 into an agentic paradigm: interfaces are dynamic, responsive to LLM reasoning, highly structured, and grounded in mathematically harmonious perceptual color science (HCT — Hue, Chroma, Tone). The visual atmosphere combines Google's clean enterprise baseline with luminous **Aurora Living Energy** accents—evoking intelligence, algorithmic precision, and continuous real-time synthesis.

### Key Characteristics

- **HCT Color Architecture:** Mathematically derived tonal palettes guaranteeing accessible contrast ratios (WCAG AA/AAA) across both Light and Dark themes.
- **Aurora Living Blues Spectrum:** High-energy Electric Azure (`#1473F2`), Sky Aqua (`#38B6FF`), Deep Cobalt (`#0077B6`), and Cosmic Violet (`#8B5CF6`) for AI reasoning and telemetry.
- **Expressive Geometry & Rounded Contours:** Systematic corner radii ranging from subtle micro-rounding (`4px`) up to fully pill-shaped contours (`9999px`), replacing rigid sharp corners with organic, approachable containment.
- **Dual-Layer Elevation Shadows:** Physically modeled ambient and key drop shadows blended with tonal surface tinting overlays.
- **Dual-Mode Theming:** First-class parity between Light (`data-theme="light"`) and Dark (`data-theme="dark"`) modes.
- **Physics-Based Motion:** Expressive cubic bezier easing curves (Emphasized Decelerate, Accelerate, Standard) and 10 duration steps (`short1` to `long2`).
- **Agentic Telemetry & Lifecycle Visibility:** Specialized componentry for AI pipeline stages, scoring indicators, confidence metrics, and cluster summaries.

---

## 2. Color Palette & Dynamic Theming

AM3 color tokens are generated using **Material Color Utilities (MCU)** within the perceptual **HCT (Hue, Chroma, Tone)** color space. Contrast is determined purely by the delta in Tone values, guaranteeing accessible contrast regardless of Hue.

### 14-Step Perceptual Tonal Scale

Every color family resolves across a 14-step tonal ladder:
`Tone 0` (Pure Black), `Tone 10`, `Tone 20`, `Tone 30`, `Tone 40`, `Tone 50`, `Tone 60`, `Tone 70`, `Tone 80`, `Tone 90`, `Tone 95`, `Tone 98`, `Tone 99`, `Tone 100` (Pure White).

### Semantic System Color Roles

| Role                        | Light Mode Value | Dark Mode Value | Semantic Description & Usage                                        |
| :-------------------------- | :--------------- | :-------------- | :------------------------------------------------------------------ |
| `primary`                   | `#1473F2`        | `#70C4F8`       | High-emphasis interactive elements, primary CTAs, active selections |
| `on-primary`                | `#FFFFFF`        | `#002D6C`       | Text and icons placed on top of `primary` containers                |
| `primary-container`         | `#D3E3FD`        | `#00458F`       | Prominent container fills, active navigation items, selected cards  |
| `on-primary-container`      | `#041E49`        | `#D3E3FD`       | Content and typography rendered inside `primary-container`          |
| `secondary`                 | `#38B6FF`        | `#A5D8FF`       | Secondary navigation badges, auxiliary actions, progress indicators |
| `on-secondary`              | `#003549`        | `#003549`       | Content rendered on top of `secondary` elements                     |
| `secondary-container`       | `#C2E7FF`        | `#004C6D`       | Subdued secondary containers, filter chip backgrounds               |
| `on-secondary-container`    | `#001D2D`        | `#C2E7FF`       | Text and icons on `secondary-container`                             |
| `tertiary`                  | `#8B5CF6`        | `#D0BCFF`       | **AI reasoning**, semantic cluster tags, LLM synthesis indicators   |
| `on-tertiary`               | `#FFFFFF`        | `#381E72`       | Text and icons on `tertiary` surfaces                               |
| `tertiary-container`        | `#EDE9FE`        | `#4F378B`       | AI insight callouts, relevance score badges, cluster pill fills     |
| `on-tertiary-container`     | `#2D1B69`        | `#EDE9FE`       | Content inside AI tertiary containers                               |
| `surface`                   | `#FFFFFF`        | `#111318`       | Base page canvas background                                         |
| `on-surface`                | `#1A1C1E`        | `#E2E2E6`       | Primary reading typography and core icons                           |
| `surface-variant`           | `#E1E2EC`        | `#44474F`       | Alternative surface fills, subtle grouping containers               |
| `on-surface-variant`        | `#44474F`        | `#C4C6D0`       | Secondary metadata, dates, article source labels, captions          |
| `surface-container-lowest`  | `#FFFFFF`        | `#0C0E12`       | Deepest recessed container underlay                                 |
| `surface-container-low`     | `#F7F9FB`        | `#17191E`       | Subtly distinct container background below standard cards           |
| `surface-container`         | `#F1F3F4`        | `#1A1D24`       | Default card, dialog, panel, and feed container background          |
| `surface-container-high`    | `#E9EBEE`        | `#252830`       | Elevated hover cards, dropdown menus, popovers                      |
| `surface-container-highest` | `#E1E3E6`        | `#30333D`       | Active modal surfaces, search bars, inputs                          |
| `outline`                   | `#74777F`        | `#8E9099`       | Component borders, card outlines, structural dividers               |
| `outline-variant`           | `#C4C6D0`        | `#44474F`       | Soft decorative borders, table dividers, subtle rules               |
| `error`                     | `#BA1A1A`        | `#FFB4AB`       | Error messages, failed ingestion status, broken feeds               |
| `on-error`                  | `#FFFFFF`        | `#690005`       | Text rendered on error surfaces                                     |
| `success`                   | `#1F8A4C`        | `#7ADE97`       | Clustered status, healthy feeds, completed pipeline steps           |

### Aurora Living Energy Spectrum

For AI synthesis moments, dynamic gradients, and live status meshes:

- **Electric Azure (`energy-mid`):** `#1473F2` — Primary interactive brand spark and focused CTA glow.
- **Google Blue (`energy-end`):** `#1A73E8` — Enterprise baseline, navigation anchors, structural coherence.
- **Sky Aqua (`energy-glow`):** `#38B6FF` (Light) / `#70C4F8` (Dark) — Telemetry pulses, embedding similarity highlights.
- **Deep Cobalt (`energy-depth`):** `#0077B6` / `#1B3B6F` — Depth accents, dark-mode underlays, elevation shadow tints.
- **Cosmic Violet (`energy-complement`):** `#8B5CF6` (Light) / `#D0BCFF` (Dark) — LLM reasoning, cluster centroids, semantic tags.

---

## 3. Typography Rules & Type Scales

AM3 typography is built upon Google's modern geometric humanist type hierarchy. For open web implementations where proprietary Google Sans packages may not be bundled, high-fidelity Google Fonts alternatives are paired with systematic fallbacks.

### Font Family Stacks

1. **Brand & Display (Headings, Heroes, Top Bar Titles):**
   - **AM3 Canonical:** `Google Sans`
   - **Closest Available Google Font:** `Plus Jakarta Sans` (or `Inter`)
   - **CSS Font Stack:** `'Plus Jakarta Sans', 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

2. **Body & Text (Content, Summaries, Form Controls, Tables):**
   - **AM3 Canonical:** `Google Sans Text`
   - **Closest Available Google Font:** `Inter` (or `Plus Jakarta Sans`, `Roboto`)
   - **CSS Font Stack:** `'Inter', 'Google Sans Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

3. **Code & Monospace (Cluster IDs, Hashes, Prompts, Terminal Logs):**
   - **AM3 Canonical:** `Google Sans Mono`
   - **Closest Available Google Font:** `JetBrains Mono` (or `Roboto Mono`)
   - **CSS Font Stack:** `'JetBrains Mono', 'Google Sans Mono', 'Roboto Mono', ui-monospace, Menlo, monospace`

### Google Fonts Import Recommendation

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
  rel="stylesheet"
/>
```

### 15 Standard Type Scales

| Scale Name        | Font Family | Size | Line Height | Weight | Tracking | Usage in `ai-news-front`                     |
| :---------------- | :---------- | :--- | :---------- | :----- | :------- | :------------------------------------------- |
| `display-large`   | Display     | 57px | 64px        | 400    | -0.25px  | Hero landing headlines, milestone banners    |
| `display-medium`  | Display     | 45px | 52px        | 400    | 0.00px   | Major section hero titles                    |
| `display-small`   | Display     | 36px | 44px        | 400    | 0.00px   | Feed overview headers, analytics highlights  |
| `headline-large`  | Display     | 32px | 40px        | 400    | 0.00px   | Top-level cluster story headlines            |
| `headline-medium` | Display     | 28px | 36px        | 400    | 0.00px   | Article detail page titles, admin view heads |
| `headline-small`  | Display     | 24px | 32px        | 400    | 0.00px   | Cluster group cards, section subtitles       |
| `title-large`     | Display     | 22px | 28px        | 400    | 0.00px   | News card title, modal dialog headers        |
| `title-medium`    | Text        | 16px | 24px        | 500    | +0.15px  | Subsection headers, list item headlines      |
| `title-small`     | Text        | 14px | 20px        | 500    | +0.10px  | Card subheaders, table column headers        |
| `body-large`      | Text        | 16px | 24px        | 400    | +0.50px  | LLM cluster synthesis, editorial summaries   |
| `body-medium`     | Text        | 14px | 20px        | 400    | +0.25px  | Article snippet excerpt, feed description    |
| `body-small`      | Text        | 12px | 16px        | 400    | +0.40px  | Timestamps, author bylines, source URLs      |
| `label-large`     | Text        | 14px | 20px        | 500    | +0.10px  | Action button labels, tabs, top nav links    |
| `label-medium`    | Text        | 12px | 16px        | 500    | +0.50px  | Filter chip labels, status badges, counters  |
| `label-small`     | Text        | 11px | 16px        | 500    | +0.50px  | Similarity scores, tags, token count pills   |

---

## 4. Shape Tokens & Corner Radii

AM3 utilizes corner geometry to establish relationship, tactile containment, and component hierarchy across 7 standardized tokens.

| Token               | Radius Value | Tailwind Class | Component Usage                                                 |
| :------------------ | :----------- | :------------- | :-------------------------------------------------------------- |
| `shape-none`        | `0px`        | `rounded-none` | Full-bleed bottom sheets, divider rules, edge-to-edge canvas    |
| `shape-extra-small` | `4px`        | `rounded-sm`   | Code syntax containers, inline tooltips, thumbnail media badges |
| `shape-small`       | `8px`        | `rounded-lg`   | Standard action buttons, snackbars, form fields, text inputs    |
| `shape-medium`      | `12px`       | `rounded-xl`   | Standard news cards, metric tiles, dropdown menus, feed cards   |
| `shape-large`       | `16px`       | `rounded-2xl`  | Elevated cluster cards, modal dialogs, drawer panels            |
| `shape-extra-large` | `28px`       | `rounded-3xl`  | Floating Action Buttons (FAB), bottom sheets, AI search bar     |
| `shape-full`        | `9999px`     | `rounded-full` | Filter chips, topic pills, status badges, avatar icons          |

---

## 5. Depth & Elevation Tokens

AM3 elevation defines physical distance above the canvas using a synchronized pair of shadows:

1. **Ambient Shadow:** Diffuse, soft occlusion light.
2. **Key Shadow:** Directional light establishing focal source.
3. **Surface Tint Overlay:** A subtle percentage fill of the `primary` color layered over the surface to provide authentic depth in both Light and Dark modes.

| Level     | Distance | Ambient Shadow                    | Key Shadow                             | Surface Tint | Usage                                          |
| :-------- | :------- | :-------------------------------- | :------------------------------------- | :----------- | :--------------------------------------------- |
| `level-0` | 0dp      | None                              | None                                   | 0%           | Base canvas background (`surface`)             |
| `level-1` | 1dp      | `0px 1px 2px rgba(0, 0, 0, 0.30)` | `0px 1px 3px 1px rgba(0, 0, 0, 0.15)`  | 5%           | Default cards, source table rows, list items   |
| `level-2` | 3dp      | `0px 1px 2px rgba(0, 0, 0, 0.30)` | `0px 2px 6px 2px rgba(0, 0, 0, 0.15)`  | 8%           | Hovered cards, raised action buttons           |
| `level-3` | 6dp      | `0px 1px 3px rgba(0, 0, 0, 0.30)` | `0px 4px 8px 3px rgba(0, 0, 0, 0.15)`  | 11%          | Menus, popovers, floating cluster toolbars     |
| `level-4` | 8dp      | `0px 2px 3px rgba(0, 0, 0, 0.30)` | `0px 6px 10px 4px rgba(0, 0, 0, 0.15)` | 12%          | Modal dialogs, side drawers, cluster inspector |
| `level-5` | 12dp     | `0px 4px 4px rgba(0, 0, 0, 0.30)` | `0px 8px 12px 6px rgba(0, 0, 0, 0.15)` | 14%          | Critical confirmation sheets, picker overlays  |

---

## 6. Motion Tokens & Physics

AM3 transitions use physics-informed cubic bezier easing curves paired with 10 calibrated duration milestones.

### Easing Curves

- **Emphasized Standard:** `cubic-bezier(0.2, 0.0, 0.0, 1.0)` — Default for two-way spatial movements, expanding cards, and general transitions.
- **Emphasized Decelerate:** `cubic-bezier(0.05, 0.7, 0.1, 1.0)` — Entering objects, dialog opens, incoming telemetry, dropdown appearances.
- **Emphasized Accelerate:** `cubic-bezier(0.3, 0.0, 0.8, 0.15)` — Exiting objects, card dismissals, sheet collapses.
- **Standard:** `cubic-bezier(0.2, 0.0, 0.0, 1.0)` — Simple property changes (color fade, border highlight).

### Duration Tokens

- `short1` (`50ms`): Micro-feedback, state layer opacity transitions.
- `short2` (`100ms`): Button press ripple, hover highlight trigger.
- `short3` (`150ms`): Icon swaps, filter chip toggle checkmark animation.
- `short4` (`200ms`): Toggle switch flip, badge counter increment.
- `medium1` (`250ms`): Card expansion, cluster article preview open.
- `medium2` (`300ms`): Navigation drawer slide, pipeline step advance.
- `medium3` (`350ms`): Bottom sheet slide up, full cluster drawer transition.
- `medium4` (`400ms`): Modal dialog entrance and scrim fade-in.
- `long1` (`450ms`): Full-screen modal transitions, layout mode shift.
- `long2` (`500ms`): Complex grid reflow, multi-cluster reorganizing.

---

## 7. Component Catalog & Architecture

AM3 specifies 79 production-ready components categorized into 10 domains: **Actions**, **Containment**, **Inputs**, **Navigation**, **Feedback**, **Chat**, **Agentic**, **Aurora**, **Charts**, and **Selection**.

Key component patterns adapted for `ai-news-front`:

### 1. Actions: Buttons & Triggers

AM3 supports 5 button emphasis variants:

- **Filled Button (High Emphasis):**
  - Background: `primary` (`#1473F2` light / `#70C4F8` dark)
  - Content/Icon: `on-primary` (`#FFFFFF` light / `#002D6C` dark)
  - Shape: `shape-small` (`8px`) or `shape-full` (`9999px`)
  - Typography: `label-large` (14px, 500 weight)
  - Height: `40px` (standard), touch target `48px`
  - Usage: Primary triggers like "Trigger Ingestion", "Save Source".

- **Filled Tonal Button (Medium Emphasis):**
  - Background: `primary-container` (`#D3E3FD` light / `#00458F` dark)
  - Content/Icon: `on-primary-container` (`#041E49` light / `#D3E3FD` dark)
  - Usage: Secondary actions like "Filter by Source", "Refresh Cluster".

- **Outlined Button (Medium Emphasis):**
  - Background: Transparent
  - Border: `1px solid outline` (`#74777F` light / `#8E9099` dark)
  - Content/Icon: `primary`
  - Usage: Alternative actions like "Cancel", "View Raw JSON".

- **Elevated Button:**
  - Background: `surface-container-low` with `level-1` shadow.
  - Hover: `level-2` shadow with `surface-container-high`.

- **Text Button (Low Emphasis):**
  - Background: Transparent; Content: `primary`.
  - Usage: Card footer links like "Read Original Source →".

### 2. Containment: Cards & Clusters

- **Standard Card (Filled Style):**
  - Background: `surface-container` (`#F1F3F4` light / `#1A1D24` dark)
  - Shape: `shape-medium` (`12px`)
  - Border: Optional `1px solid outline-variant` for crisp boundary definition.
  - Padding: `24px` internal spacing.
  - Hover State: Transitions to `surface-container-high` (`#E9EBEE` / `#252830`) with `short2` (100ms) easing.

- **Elevated Cluster Card:**
  - Background: `surface-container-low` (`#F7F9FB` light / `#17191E` dark)
  - Elevation: `level-1` baseline, animating to `level-2` on hover.
  - Shape: `shape-large` (`16px`)
  - Header: Contains Cluster Title (`headline-small`), Source Badge pills, and LLM Summary (`body-large`).

- **Container Bleed Protocol:**
  - When embedding media banners or full-width divider rules inside cards, AM3 components utilize the `bleed` prop to negative-margin align content directly to card perimeter edges.

### 3. Selection: Chips & Pills

- **Filter Chip:**
  - Container: `surface-container-low` unselected; `secondary-container` selected.
  - Border: `1px solid outline-variant` unselected; borderless selected.
  - Shape: `shape-full` (`9999px`)
  - Typography: `label-medium` (12px, 500 weight)
  - Height: `32px`
  - Icons: Optional leading checkmark or source favicon.
  - Usage: Filtering news feeds by topic tags (e.g. `LLMs`, `Hardware`, `Robotics`).

- **AI Insight Pill (Tertiary Variant):**
  - Container: `tertiary-container` (`#EDE9FE` light / `#4F378B` dark)
  - Content: `on-tertiary-container` (`#2D1B69` light / `#EDE9FE` dark)
  - Usage: Displaying relevance scores (e.g., `Score: 8.5/10`) and semantic cosine similarity indicators.

### 4. Navigation: Top App Bar

- **Variants:** Small (`64px`), Medium (`112px`), Large (`152px`).
- **Hierarchy:**
  - Background: `surface` with scroll-pinned transition to `surface-container-low` + `level-2` elevation.
  - Title: `title-large` (22px) or `headline-medium` (28px).
  - Actions: Search trigger, theme switcher (Dark/Light toggle), manual ingest trigger, and admin route links.

### 5. Inputs & Form Fields

- **Outlined Text Field:**
  - Container: Transparent with `1px solid outline`
  - Focused Border: `2px solid primary` (`#1473F2` / `#70C4F8`)
  - Shape: `shape-small` (`8px`)
  - Label: Floats to upper border in `body-small` with `primary` tint on focus.
  - Height: `56px` standard touch target.

### 6. Agentic & Telemetry Components

- **Pipeline Step Visualizer:**
  - Displays the 9-step ingestion workflow (`fetch URLs` → `deduplicate` → `scrape content` → `score relevance` → `generate embeddings` → `cluster` → `summarize` → `persist`).
  - Active Step: Pulsing `primary` glow (`energy-mid`) with animated circular progress indicator.
  - Completed Step: `success` checkmark (`#1F8A4C` / `#7ADE97`).
  - Failed Step: `error` icon (`#BA1A1A` / `#FFB4AB`) with swizzleable retry button.

- **Optimistic Hydration Overlays:**
  - Instant client-side state preview while background Firestore persistence and Gemini calls complete.

---

## 8. Layout Principles & Spacing Grid

### Base Unit & Spacing Scale

AM3 uses an **8px grid** with 4px half-steps for micro-alignments:

- **Micro (4px):** Inline icon-to-text spacing, tight badge padding.
- **Small (8px):** Internal button padding, compact list item gaps.
- **Medium (16px):** Standard component padding, form field gaps.
- **Large (24px):** Card internal padding, sidebar item separation.
- **X-Large (32px):** Grid column gaps, section header margin.
- **2X-Large (48px):** Major layout section gaps.
- **3X-Large (64px):** Hero container separation and page footer clearance.

### Grid & Max-Width

- **Max Container Width:** `1280px` (or `1440px` for wide desktop dashboards).
- **Responsive Columns:**
  - Desktop (≥1024px): 3-column cluster card grid or 2-column with sticky sidebar.
  - Tablet (768px–1023px): 2-column adaptive grid.
  - Mobile (<768px): 1-column full-width card stack.

---

## 9. Do's and Don'ts

### Do

- **Do leverage the 14-step HCT tonal system** to ensure contrast compliance between text (`on-surface`, `on-primary`) and backgrounds.
- **Do apply `shape-medium` (12px) to standard cards** and `shape-full` (9999px) to filter chips and badges.
- **Do use `tertiary` tokens (`#8B5CF6` / `#D0BCFF`)** specifically for AI-generated reasoning, cluster summaries, and score badges.
- **Do utilize dual-layer shadows (`level-1` to `level-3`)** combined with surface tinting for elevated cards and dropdown menus.
- **Do support full Dark and Light theme parity** using semantic variables rather than hardcoded hex values.
- **Do animate interactive states** using Emphasized easing curves (`cubic-bezier(0.2, 0.0, 0.0, 1.0)`) and appropriate durations (`short2` to `medium2`).

### Don't

- **Don't use `0px` sharp corners** everywhere—AM3 is an expressive, contoured design system with tactile rounded geometry.
- **Don't hardcode pure black (`#000000`) or harsh stark gray** for dark mode backgrounds—use AM3's calibrated `surface` (`#111318`) and `surface-container` (`#1A1D24`).
- **Don't use random non-token box shadows**; always combine ambient and key shadows matching the 6 standard elevation levels.
- **Don't use high-saturation accent colors for long paragraph text**; reserve `primary` and `secondary` for interactive triggers, labels, and badges.
- **Don't omit touch target considerations**; interactive controls must always maintain at least `48px` effective clickable area on touch devices.

---

## 10. Responsive Breakpoints & Touch Guidelines

| Breakpoint            | Viewport Width   | Container Width     | Layout Behavior                                                                         |
| :-------------------- | :--------------- | :------------------ | :-------------------------------------------------------------------------------------- |
| Compact (Phone)       | `< 600px`        | 100%                | Single column, navigation bar at bottom or collapsed app bar, full-width action buttons |
| Medium (Tablet)       | `600px – 839px`  | Fluid (16px margin) | 2-column card grid, navigation rail or expandable top app bar                           |
| Expanded (Desktop)    | `840px – 1199px` | `100% max 1120px`   | 2–3 column card grid, persistent navigation drawer or top app bar                       |
| Large (Large Desktop) | `≥ 1200px`       | `max 1280px`        | 3-column cluster feed, detailed telemetry sidebar, wide dashboard layout                |

### Touch Target Standard

- All interactive controls (buttons, chips, icon toggles) must provide an active touch hit-area of at least **`48px × 48px`** (achieved via padding or transparent touch targets even if visual height is 32px or 40px).

---

## 11. Agent Prompt Guide & Quick Reference

### Quick Token Reference

```css
:root {
  /* Light Mode (AM3 GM3 Aurora Living Blues) */
  --am3-primary: #1473f2;
  --am3-on-primary: #ffffff;
  --am3-primary-container: #d3e3fd;
  --am3-on-primary-container: #041e49;
  --am3-secondary: #38b6ff;
  --am3-tertiary: #8b5cf6; /* AI Reasoning & Clusters */
  --am3-tertiary-container: #ede9fe;
  --am3-on-tertiary-container: #2d1b69;
  --am3-surface: #ffffff;
  --am3-surface-container: #f1f3f4;
  --am3-surface-container-high: #e9ebee;
  --am3-outline: #74777f;
  --am3-outline-variant: #c4c6d0;

  /* Typography */
  --font-display: "Plus Jakarta Sans", "Google Sans", sans-serif;
  --font-body: "Inter", "Google Sans Text", sans-serif;
  --font-mono: "JetBrains Mono", "Google Sans Mono", monospace;

  /* Shape */
  --shape-xs: 4px;
  --shape-sm: 8px;
  --shape-md: 12px;
  --shape-lg: 16px;
  --shape-xl: 28px;
  --shape-full: 9999px;

  /* Elevation (Level 1) */
  --elevation-1: 0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15);
  --elevation-2: 0px 1px 2px rgba(0, 0, 0, 0.3), 0px 2px 6px 2px rgba(0, 0, 0, 0.15);
  --elevation-3: 0px 1px 3px rgba(0, 0, 0, 0.3), 0px 4px 8px 3px rgba(0, 0, 0, 0.15);

  /* Motion */
  --easing-emphasized: cubic-bezier(0.2, 0, 0, 1);
  --duration-short2: 100ms;
  --duration-medium2: 300ms;
}

[data-theme="dark"] {
  --am3-primary: #70c4f8;
  --am3-on-primary: #002d6c;
  --am3-primary-container: #00458f;
  --am3-on-primary-container: #d3e3fd;
  --am3-secondary: #a5d8ff;
  --am3-tertiary: #d0bcff;
  --am3-tertiary-container: #4f378b;
  --am3-on-tertiary-container: #ede9fe;
  --am3-surface: #111318;
  --am3-surface-container: #1a1d24;
  --am3-surface-container-high: #252830;
  --am3-outline: #8e9099;
  --am3-outline-variant: #44474f;
}
```

### Component Implementation Checklist

1. **Card Components:** Use `bg-[var(--am3-surface-container)]`, `rounded-xl` (`shape-medium`), optional `border border-[var(--am3-outline-variant)]`, and `hover:shadow-[var(--elevation-2)]` transition.
2. **AI Cluster / Summary Highlights:** Wrap in `bg-[var(--am3-tertiary-container)] text-[var(--am3-on-tertiary-container)] rounded-2xl` (`shape-large`).
3. **Filter Pills:** Apply `rounded-full` (`shape-full`), `h-8`, `px-4`, `text-xs font-medium` (`label-medium`), with active state using `bg-[var(--am3-primary-container)]`.
4. **Primary Action Buttons:** Apply `rounded-lg` (`shape-small`) or `rounded-full`, `bg-[var(--am3-primary)] text-[var(--am3-on-primary)] hover:opacity-95 transition-all duration-100 ease-[var(--easing-emphasized)]`.
5. **Type Pairing:** Display titles with `Plus Jakarta Sans` / `Google Sans` (`font-display`), body narratives with `Inter` / `Google Sans Text` (`font-body`), code and metrics with `JetBrains Mono` (`font-mono`).
