# Design System Inspired by Printing Press

## 1. Visual Theme & Atmosphere

The Printing Press design system embodies a sophisticated, editorial aesthetic rooted in classical typography and minimalist print design. It evokes the warmth and intentionality of letterpress printing combined with contemporary digital clarity. The palette is deliberately restrained—dominated by warm neutrals and deep charcoals—creating an atmosphere of intellectual elegance and accessibility. This is a design language for developers and creators who value precision, clarity, and the beauty of functional simplicity. Every element speaks with purpose; there is no visual noise, only deliberate contrast and careful hierarchy.

**Key Characteristics**

- Warm, paper-like neutral palette with minimal color saturation
- Sharp, unadorned geometry with zero border radius (hard edges throughout)
- Display serif typography (Newsreader) paired with clean sans-serif (Geist)
- Monospaced code font (Geist Mono) for technical clarity
- Generous whitespace and breathing room between elements
- Single-pixel borders define container boundaries
- Accents of deep forest green and vibrant magenta for semantic meaning
- Print-inspired, editorial layout with strong typographic hierarchy

## 2. Color Palette & Roles

### Primary

- **Deep Charcoal** (`#1B1816`): Primary text color, borders, and structural elements. The workhorse color used throughout for maximum contrast and legibility on light backgrounds.
- **Warm Cream** (`#F4EFE6`): Primary background color for page surfaces, creating a paper-like, approachable canvas.

### Accent Colors

- **Magenta Signal** (`#E5006D`): Accent for highlights, decorative elements, call-outs, and interactive focus states. Commands attention without dominating the visual hierarchy.
- **Forest Green** (`#1F6B3A`): Semantic indicator for active states, success, or positive indicators (e.g., "PRESS IS OPEN" status).

### Interactive

- **Light Cream Surface** (`#EDE6D8`): Interactive component backgrounds (buttons, cards, input surfaces). Provides subtle visual separation while maintaining warmth.
- **Button Border & Text** (`#1B1816`): Ensures readable, crisp interaction elements with strong contrast.

### Neutral Scale

- **Medium Taupe** (`#5A524A`): Secondary text color, metadata, smaller UI text, and de-emphasized labels. Adds visual hierarchy without losing legibility.
- **Light Taupe** (`#9A8F82`): Tertiary text for captions, hints, and smallest UI text. Used sparingly to maintain readability.

### Surface & Borders

- **Card Surface** (`#EDE6D8`): Container and card backgrounds with a warm, inviting tone.
- **Border Color** (`#1B1816`): Single-pixel borders throughout, creating crisp definition and graphic quality.

## 3. Typography Rules

### Font Family

**Primary Display & Headings:** Newsreader (serif, classic editorial feel)

- Fallback stack: `'Newsreader', 'Georgia', 'Times New Roman', serif`

**Body & UI:** Geist (sans-serif, modern and clean)

- Fallback stack: `'Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', sans-serif`

**Code & Technical:** Geist Mono (monospace, for code and technical content)

- Fallback stack: `'Geist Mono', 'Courier New', 'Courier', monospace`

### Hierarchy

| Role               | Font       | Size | Weight | Line Height | Letter Spacing | Notes                                  |
| ------------------ | ---------- | ---- | ------ | ----------- | -------------- | -------------------------------------- |
| Display / H1       | Newsreader | 56px | 400    | 58.8px      | Normal         | Hero headlines, main page title        |
| Heading / H2       | Newsreader | 36px | 400    | 37.8px      | Normal         | Section headers, major divisions       |
| Subheading / H3    | Newsreader | 32px | 400    | 33.6px      | Normal         | Subsection titles, card headers        |
| Body Text          | Geist      | 16px | 400    | 24.8px      | Normal         | Primary paragraph content              |
| Span / Lead Text   | Newsreader | 18px | 400    | 18.9px      | Normal         | Emphasized body copy, pull quotes      |
| Small Text / UI    | Newsreader | 11px | 400    | 17.05px     | Normal         | Buttons, badges, UI labels             |
| Metadata / Caption | Geist      | 14px | 400    | 21.7px      | Normal         | Secondary labels, navigation, metadata |
| Code / Terminal    | Geist Mono | 14px | 400    | 21px        | Normal         | Code blocks, command examples          |

### Principles

- **Serif-first authority:** Display hierarchy uses Newsreader serif for editorial gravitas and credibility.
- **Contrast through scale:** Font size, not weight, drives hierarchy. All fonts remain at weight 400 for consistent openness.
- **Generous line height:** 1.4–1.5 multiplier for optimal readability and breathing room.
- **Monospace for precision:** Code and technical examples use Geist Mono to signal functionality and accuracy.
- **No font-weight variation:** The design relies on size and color differentiation rather than bold weights, maintaining visual lightness.

## 4. Component Stylings

### Buttons

**Primary Button (Standard)**

- Background: `#F4EFE6`
- Text Color: `#1B1816`
- Font: Newsreader, 11px, weight 400
- Padding: `2px 16px`
- Border: `1px solid #1B1816`
- Border Radius: `0px`
- Line Height: `17.05px`
- Height: `23px` (intrinsic)
- Hover State: Background `#EDE6D8`, maintain border

**Navigation Button (Full-width, minimal style)**

- Background: Transparent
- Text Color: `#1B1816`
- Font: Geist, 16px, weight 400
- Padding: `8px 0px`
- Border: None
- Line Height: `24.8px`
- Height: `48px`
- Hover State: Text color shifts to `#5A524A`

**Icon / Utility Button**

- Background: `#F4EFE6`
- Text Color: `#1B1816`
- Font: Geist Mono, 12px, weight 400
- Padding: `0px`
- Border: `1px solid #1B1816`
- Border Radius: `0px`
- Width: `32px`, Height: `32px`
- Hover State: Background `#EDE6D8`

### Cards & Containers

**Card (Standard Content Container)**

- Background: `#EDE6D8`
- Text Color: `#1B1816`
- Font: Geist, 16px, weight 400
- Padding: `40px`
- Border: `1px solid #1B1816`
- Border Radius: `0px`
- Line Height: `24.8px`
- Hover State: Subtle shadow or background shift to `#F4EFE6`

**Navigation Bar / Header Container**

- Background: `#EDE6D8`
- Text Color: `#1B1816`
- Font: Geist, 16px, weight 400
- Padding: `6px 24px`
- Border: `1px solid #1B1816`
- Border Radius: `0px`
- Height: `38px` (intrinsic)
- Line Height: `24.8px`

### Inputs & Forms

**Text Input / Form Field**

- Background: `#F4EFE6`
- Text Color: `#1B1816`
- Font: Geist, 14px, weight 400
- Padding: `8px 12px`
- Border: `1px solid #1B1816`
- Border Radius: `0px`
- Focus State: Border color shifts to `#E5006D`, background remains `#F4EFE6`
- Line Height: `21.7px`

**Code Input / Monospace Field**

- Background: `#F4EFE6`
- Text Color: `#1B1816`
- Font: Geist Mono, 14px, weight 400
- Padding: `12px`
- Border: `1px solid #1B1816`
- Border Radius: `0px`
- Focus State: Border color to `#E5006D`
- Line Height: `21px`

### Navigation

**Link (Standard, primary color)**

- Background: Transparent
- Text Color: `#1B1816`
- Font: Newsreader, 18px, weight 400
- Padding: None
- Border: None
- Line Height: `18.9px`
- Hover State: Text color shifts to `#5A524A`, optional underline

**Link (Secondary, smaller)**

- Background: Transparent
- Text Color: `#5A524A`
- Font: Geist, 14px, weight 400
- Padding: None
- Border: None
- Line Height: `21.7px`
- Hover State: Text color shifts to `#1B1816`

### Badges & Status Indicators

**Status Badge (Active)**

- Background: `#1F6B3A` (forest green)
- Text Color: `#F4EFE6`
- Font: Geist, 11px, weight 400
- Padding: `4px 8px`
- Border: None
- Border Radius: `0px`

**Accent Badge**

- Background: Transparent
- Text Color: `#E5006D`
- Font: Geist, 11px, weight 400
- Padding: `4px 8px`
- Border: `1px solid #E5006D`
- Border Radius: `0px`

## 5. Layout Principles

### Spacing System

**Base Unit:** 8px

**Spacing Scale:**

- **Micro:** `8px` — Padding inside small components, tight grouping
- **Extra Small:** `16px` — Padding in buttons, labels, small gaps
- **Small:** `24px` — Space between form fields, between UI elements
- **Medium:** `32px` — Gap between related sections, moderate breathing room
- **Large:** `40px` — Padding inside cards and containers
- **Extra Large:** `48px` — Space between major content blocks
- **XXL:** `60px` — Margin between page sections
- **XXXL:** `80px` — Margin for major section breaks
- **Extreme:** `96px` — Top/bottom margins for hero sections

**Usage Context:**

- `8px` for button padding and compact component spacing
- `16px` for input padding and form field separation
- `24px` for navigation and small gaps between UI elements
- `40px` for card padding and contained content blocks
- `60px–96px` for whitespace between major page sections (generous breathing room)

### Grid & Container

**Max Width:** 1224px (primary content container)

**Column Strategy:**

- Single-column layout with flexible alignment
- Cards and containers use full width up to max-width constraint
- Sidebar/complementary content can sit adjacent at larger viewports but stacks on smaller screens

**Section Patterns:**

- Hero section with max-width content, centered or left-aligned
- Content cards in a flexible grid (1–2 columns depending on viewport)
- Navigation bar fixed or sticky at top with full-width background
- Footer with full-width background, centered text content

### Whitespace Philosophy

Whitespace is an active design element, not negative space. Generous margins and padding create breathing room, reduce cognitive load, and emphasize the editorial quality of the layout. Sections are separated by substantial vertical space (60–96px), and within containers, content has ample internal padding (`40px` or more). This philosophy extends to typography: larger line heights and spacing between paragraphs reinforce clarity and elegance.

### Border Radius Scale

- **Sharp Edges:** `0px` — All components use zero radius for a crisp, print-like quality. No rounded corners throughout the system.

_Note:_ The design system intentionally rejects border radius entirely, favoring hard geometric lines that evoke traditional print and technical design aesthetics.

## 6. Depth & Elevation

| Level              | Treatment                                        | Use                                       |
| ------------------ | ------------------------------------------------ | ----------------------------------------- |
| Ground (Level 0)   | No shadow, flat surface                          | Page background, base content layer       |
| Raised (Level 1)   | Optional: `0px 1px 2px rgba(27, 24, 22, 0.05)`   | Cards on light backgrounds, subtle lift   |
| Floating (Level 2) | Optional: `0px 4px 8px rgba(27, 24, 22, 0.1)`    | Modals, popovers, interactive overlays    |
| Modal (Level 3)    | Optional: `0px 12px 24px rgba(27, 24, 22, 0.15)` | Full-page overlays, critical interactions |

**Shadow Philosophy:**

The Printing Press design system favors minimal to no shadows by default. The aesthetic is rooted in print design, where elevation is conveyed through borders, contrast, and layout rather than photorealistic depth. When shadows are used (for interactive states or critical emphasis), they remain subtle and muted. A single-pixel border is the primary method for defining separation and containment. Shadows, if employed, should use the deep charcoal color (`#1B1816`) at very low opacity (`0.05–0.15`) to maintain the warm, approachable tone. This restraint preserves visual clarity and reinforces the editorial, intentional quality of the design.

## 7. Do's and Don'ts

### Do

- **Use crisp `0px` borders** to define containers and components—single pixel, `#1B1816` color.
- **Leverage generous whitespace** between sections (60–96px) to create visual hierarchy and emphasize content.
- **Pair Newsreader serif with Geist sans-serif** deliberately: serif for headings and emphasis, sans-serif for body and UI.
- **Maintain consistent `40px` padding** inside cards and containers for uniform visual rhythm.
- **Use color strategically:** `#E5006D` for accents and focus, `#1F6B3A` for status/active states, `#5A524A` for secondary text.
- **Stack elements vertically** with clear visual breaks rather than dense horizontal layouts.
- **Use monospace (Geist Mono)** exclusively for code, commands, and technical content.
- **Apply single-weight (400) typography** across all fonts; let size and color drive hierarchy.

### Don't

- **Never use border radius.** All components have `0px` radius for graphic sharpness and print quality.
- **Avoid heavy shadows or depth effects.** Borders define structure, not photorealistic elevation.
- **Don't mix multiple serif or sans-serif families.** Stick to Newsreader, Geist, and Geist Mono only.
- **Avoid font-weight variation (bold, 700, etc.).** Hierarchy is achieved through size, color, and spacing.
- **Don't use backgrounds with low contrast.** Text and backgrounds must maintain at least WCAG AA contrast ratios.
- **Avoid cluttering whitespace.** Dense layouts contradict the editorial, minimalist ethos.
- **Don't use the accent magenta (`#E5006D`) for body text.** Reserve it for highlights, interactive states, and call-outs.
- **Never override the warm cream palette with cold grays or whites.** Maintain the warm, paper-like aesthetic throughout.

## 8. Responsive Behavior

### Breakpoints

| Name             | Width         | Key Changes                                                                                                           |
| ---------------- | ------------- | --------------------------------------------------------------------------------------------------------------------- |
| Mobile (XS)      | 320px–479px   | Single column, full-width cards, `24px` container padding, smaller `24px` gaps between sections, buttons full-width   |
| Small (S)        | 480px–767px   | Single column, `32px` container padding, `32px` gaps between sections, card width at 100%                             |
| Medium (M)       | 768px–1023px  | Single–two column flexible layout, `40px` container padding, `48px` gaps, cards can sit side-by-side if space permits |
| Large (L)        | 1024px–1223px | Two-column grid, max-width 1024px container, `48px` padding, full `60px` gaps between major sections                  |
| Extra Large (XL) | 1224px+       | Two-column or wide layout, max-width 1224px enforced, `80px` gaps between sections, full sidebar support              |

### Touch Targets

- **Minimum interactive size:** `44px` × `44px` (buttons, links, clickable elements)
- **Button padding:** Ensure at least `8px` of padding on all sides for comfortable touch interaction
- **Link spacing:** Maintain at least `16px` horizontal and `12px` vertical separation between adjacent links to avoid accidental mis-taps
- **Form inputs:** Minimum `40px` height, with `12px` horizontal padding for comfortable text entry on touch devices

### Collapsing Strategy

- **Navigation:** Stack vertically on mobile (M and below); horizontal bar on larger screens (L and up).
- **Cards:** Single column on mobile (XS–S); two-column grid on medium and larger (M and up), responsive to available space.
- **Hero sections:** Full-width text and images on all breakpoints; reduce font size and padding on XS/S (h1: 40px instead of 56px on mobile).
- **Padding reduction:** Container padding reduces from `48px` (L/XL) to `24px` (XS/S) to preserve screen real estate on small devices.
- **Section gaps:** Vertical spacing reduces from `96px` (L/XL) to `48px` (M) to `32px` (XS/S) to maintain visual rhythm without overwhelming small viewports.
- **Code blocks:** Monospace text size reduces to `12px` on XS/S with horizontal scroll if necessary to maintain readability.

## 9. Agent Prompt Guide

### Quick Color Reference

- **Primary Text & Borders:** Deep Charcoal (`#1B1816`)
- **Primary Background:** Warm Cream (`#F4EFE6`)
- **Card / Container Surface:** Light Cream (`#EDE6D8`)
- **Accent / Highlight:** Magenta Signal (`#E5006D`)
- **Active / Success Status:** Forest Green (`#1F6B3A`)
- **Secondary Text:** Medium Taupe (`#5A524A`)
- **Tertiary Text:** Light Taupe (`#9A8F82`)

### Iteration Guide

1. **Typography foundation:** All text uses Newsreader (serif, headings/display), Geist (sans-serif, body/UI), or Geist Mono (code). No other fonts. Weight always 400; vary size for hierarchy.

2. **Borders define structure:** Every container, button, card, and input has a `1px solid #1B1816` border. Zero border radius everywhere. Borders are the primary visual structure element.

3. **Spacing in multiples of 8px:** All padding, margins, gaps use values from the spacing scale (`8px`, `16px`, `24px`, `32px`, `40px`, `48px`, `60px`, `80px`, `96px`). Maintain proportional rhythm.

4. **Color hierarchy:** Primary interactions use `#F4EFE6` or `#EDE6D8` backgrounds with `#1B1816` text/borders. Accents and highlights use `#E5006D` sparingly. Status states use `#1F6B3A` (active/success).

5. **Button consistency:** All buttons have `0px` border radius, `1px` border, and either transparent or light cream background. Text color is `#1B1816` (primary) or inherit from context (secondary buttons).

6. **Card padding standard:** Cards always use `40px` internal padding, `1px #1B1816` border, `0px` radius, and `#EDE6D8` background. Maintain this across all card variants.

7. **Whitespace is intentional:** Sections separated by at least `60px` (mobile: `32px`) vertical space. No cramped layouts. Breathing room reinforces editorial quality.

8. **Hover and focus states:** Buttons and links shift text color from `#1B1816` to `#5A524A` on hover. Interactive elements can gain a border color shift to `#E5006D` on focus. Never add rounded corners or shadows for state changes.

9. **Responsive scaling:** Font sizes and padding reduce proportionally on smaller screens (mobile: h1 40px, desktop: 56px). Max-width container is `1224px`. Use flex or grid with intelligent stacking; never force two-column layouts on devices under 768px.

10. **Monospace strictness:** Code blocks, terminal commands, and technical examples use Geist Mono exclusively at `14px` (mobile: `12px`). Always pair with `#F4EFE6` background and `1px #1B1816` border to signal code context.
