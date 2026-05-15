# Plan: Day-based Infinite Scroll Pagination

## Dependency Graph

```
Task 1: getNewsByDay (lib/firebase.ts)
  └─► Task 2: API ?date= param (app/api/news/route.ts)
        └─► Task 3: Page state refactor + initial load (app/page.tsx)
              ├─► Task 4: IntersectionObserver + loadNextDay (app/page.tsx)
              ├─► Task 5: Date range filter override (app/page.tsx)
              └─► Task 6: Loading / end-of-feed UI (app/page.tsx)
```

Tasks 4, 5, 6 are all in `page.tsx` and can be done in one pass after Task 3.

## Files Modified

| File | Changes |
|---|---|
| `lib/firebase.ts` | Add `getNewsByDay` |
| `app/api/news/route.ts` | Add `?date=` branch, import `getNewsByDay` |
| `app/page.tsx` | State refactor, `initFeed`, `loadNextDay`, `IntersectionObserver`, date range effect, sentinel JSX |

No changes to: `components/news-list.tsx`, `hooks/use-news-filters.ts`, `components/filter-panel.tsx`.

## Verification

1. Start dev server — only 3 `GET /api/news?date=...` requests on initial load
2. Scroll to bottom — next day loads and appends
3. Domain filter applies to loaded articles only
4. Date range set → bypasses pagination, loads range directly
5. Date range cleared → paginated feed resets to last 3 days
6. `npx tsc --noEmit` passes
