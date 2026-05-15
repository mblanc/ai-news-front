# AGENTS.md

This file provides guidance to ai agents when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint via next lint
npx tsc --noEmit # Type-check without emitting
```

No test suite is configured.

## Authentication requirements

Two services both use Application Default Credentials (ADC) — no API keys, no service account file by default:

- **Firestore** (`lib/firebase.ts`): `@google-cloud/firestore` with `projectId` from `GOOGLE_CLOUD_PROJECT_ID`
- **Vertex AI / Gemini** (`lib/ai-utils.ts`): `@google/genai` with `vertexai: true`, `project` from `GOOGLE_CLOUD_PROJECT_ID`, `location` from `GOOGLE_CLOUD_LOCATION`

Run `gcloud auth application-default login` before starting the dev server. Without it, both Firestore reads and AI summarization will fail silently.

Required `.env.local` keys:
```
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_LOCATION=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
```

## Architecture

**Data flow:** Firestore → `/api/news` route → `page.tsx` state → `useNewsFilters` hook → `NewsList`. All filtering/sorting happens client-side via the hook; the API route returns the full unfiltered dataset.

**Summarization flow:** Summarize button in `NewsList` → `onSummarize` callback → `page.tsx` sets `selectedNews` + opens `SummaryDialog` → `useEffect` in `SummaryDialog` watches `open` + `news.id` and fires `POST /api/summarize-single` → Vertex AI Gemini 2.5 Flash.

**Key architectural decisions:**
- `SummaryDialog` is mounted only when `selectedNews !== null` (early return null). Generation is triggered by a `useEffect` watching `open` and `news.id`, not by Radix's `onOpenChange` (which only fires on user-initiated close, not programmatic open).
- `FilterOptions` in `filter-panel.tsx` is the shared type for filters. `SortOption` is a string union `"date-desc" | "date-asc" | "domain-asc" | "domain-desc"` — sort field and direction are combined, not separate.
- `NewsList` groups articles into sections by date or domain (depending on sort field) and renders them as editorial section headers. This grouping happens inside the component, after `useNewsFilters` has already sorted.
- `lib/format-date.ts` normalises dates that may arrive as JS `Date`, ISO string, or Firestore `{seconds, nanoseconds}` objects. Use `formatDate` / `formatDateLong` from here everywhere — do not call `new Date(item.date.seconds * 1000)` directly (the API route serialises dates to ISO strings before they reach the client).

## Design system

The app uses the **Printing Press** design system defined in `DESIGN.md`. Key rules:
- Zero border radius everywhere (`--radius: 0rem`)
- Font stack: `font-newsreader` (Newsreader serif) for display headings only; `font-sans` (Geist) for all UI labels, buttons, metadata; `font-mono` (Geist Mono) for timestamps
- Tailwind v4 with `@import "tailwindcss"` and `@theme inline` — CSS variables are defined in `:root` in `globals.css`, not in `tailwind.config`
- Theme is light-only. `ThemeProvider` has `defaultTheme="light" enableSystem={false}`. Dark mode token block in `globals.css` mirrors light intentionally.
- `font-newsreader` is a manual `@layer base` CSS class, not a Tailwind theme token (avoids circular variable reference)

## Component conventions

- All interactive `<button>` elements must have explicit `type="button"` (or `type="submit"` for form submits) — the search bar wraps its clear button in a `<form>`.
- Radix Dialog requires either `<DialogDescription>` or `aria-describedby={undefined}` on `DialogContent` — always add a `DialogDescription` with `className="sr-only"` if there's no visible description.
- Domain favicons use `DomainIcon` component (`components/domain-icon.tsx`) which fetches from Google's favicon API and falls back to `Globe`.
- `FilterPanel` is collapsible on mobile (`lg:hidden` chevron toggle). On desktop it's always open via `lg:block`.
