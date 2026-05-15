# Todo: Day-based Infinite Scroll Pagination

## Tasks

- [x] **Task 1** — `lib/firebase.ts`: Add `getNewsByDay(date: Date)` — queries Firestore for a single calendar day using startOfDay / endOfDay bounds, same mapping pattern as `getNewsByDateRange`
- [x] **Task 2** — `app/api/news/route.ts`: Handle `?date=YYYY-MM-DD` param, call `getNewsByDay`, add import
- [x] **Task 3** — `app/page.tsx`: Replace flat state with `initialLoading`, `initialError`, `isLoadingMore`, `hasMore`, `oldestDay`; replace `fetchNews` with `initFeed` that fetches last 3 days in parallel
- [x] **Task 4** — `app/page.tsx`: Add `loadNextDay` (skip empty days, up to 30 back), `sentinelRef`, `IntersectionObserver` effect
- [x] **Task 5** — `app/page.tsx`: Add `useEffect` on `filters.dateRange` — fetch range directly when set, restore `initFeed` when cleared
- [x] **Task 6** — `app/page.tsx`: Update JSX — rename loading/error refs, add sentinel div, `isLoadingMore` spinner, "All articles loaded" end state

## Status: COMPLETE ✓
