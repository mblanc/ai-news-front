# SPEC.md — Day-based Infinite Scroll Pagination

## Objective

Replace the "load everything at once" model with day-by-day server-side pagination. On load, fetch the last 3 days of articles. As the user scrolls to the bottom, automatically fetch the next oldest day. This reduces the initial payload and keeps the existing editorial grouped-by-date layout intact.

**Target users:** Same as the app — developers and AI enthusiasts reading daily news.

---

## Acceptance Criteria

- [ ] Initial page load fetches articles for today, yesterday, and 2 days ago only
- [ ] A sentinel div at the bottom of the list triggers loading the next day when it enters the viewport (IntersectionObserver)
- [ ] Each new day loads as a new section appended below existing sections — same grouped heading format as today
- [ ] A loading indicator appears at the bottom while the next day is fetching
- [ ] "No more articles" message shown when no older articles exist for a given day (skip empty days, try up to 30 days back before showing end-of-feed)
- [ ] Domain filter and search apply to all currently-loaded articles (not across unloaded days — this is an accepted limitation)
- [ ] Sort by domain still works on loaded data; sort by date works naturally
- [ ] Date range filter: when set, bypass pagination and load that specific range directly via a dedicated query

---

## Architecture

### API changes

Extend `/api/news` with a `date` query param:

```
GET /api/news?date=2025-05-14     → all articles for that day
GET /api/news                     → unchanged (returns all, kept for backwards compat)
```

Add `getNewsByDay(date: Date): Promise<NewsItem[]>` to `lib/firebase.ts`:
- Query: `where("date", ">=", startOfDay).where("date", "<", startOfNextDay).orderBy("date", "desc")`
- Note: the `date` field in Firestore may be stored as a string or Timestamp — verify at implementation time and adjust the query accordingly. If stored as strings, use ISO date string bounds (`"2025-05-14T00:00:00.000Z"` to `"2025-05-15T00:00:00.000Z"`).

### State model (`app/page.tsx`)

Replace `news: NewsItem[]` (flat array, all loaded) with:

```ts
// days loaded so far, in descending order
const [loadedDays, setLoadedDays] = useState<string[]>([])   // ISO date strings: "2025-05-14"
const [news, setNews] = useState<NewsItem[]>([])              // accumulates across days
const [isLoadingMore, setIsLoadingMore] = useState(false)
const [hasMore, setHasMore] = useState(true)
const [oldestLoadedDay, setOldestLoadedDay] = useState<string | null>(null)
```

Initial load: fetch the 3 most recent days in parallel using `Promise.all`.

### Infinite scroll trigger

Place a `<div ref={sentinelRef} />` below `<NewsList>`. Use `IntersectionObserver` to watch it. When it intersects, call `loadNextDay()`.

`loadNextDay()`:
1. Compute the day after `oldestLoadedDay` going back in time
2. Call `/api/news?date=<that-day>`
3. If result is empty, skip and try the day before (up to 30 consecutive empty days before setting `hasMore = false`)
4. Append results to `news`, update `oldestLoadedDay`

### Filtering interaction

`useNewsFilters` continues to operate on the full `news` array (all loaded days). No changes to the hook. The trade-off — domain filter only applies to loaded days — should be noted in the UI with a subtle label: "Showing results across loaded articles."

### Date range filter override

When `filters.dateRange` is set, bypass the paginated model entirely:
- Fetch the range via `/api/news?startDate=&endDate=` (existing route params already support this)
- Replace `news` with the range result
- Disable infinite scroll while a date range is active
- On date range clear, restore the paginated feed (re-fetch initial 3 days)

---

## Project structure changes

```
lib/firebase.ts          — add getNewsByDay(date: Date)
app/api/news/route.ts    — handle ?date= param, call getNewsByDay
app/page.tsx             — replace flat news state with paginated model + IntersectionObserver
components/news-list.tsx — no changes needed (receives same NewsItem[])
```

No new files required beyond what already exists.

---

## Code style

Follow existing patterns:
- `useCallback` for all fetch functions in `page.tsx`
- Firestore functions in `lib/firebase.ts`, not inline in routes
- API routes stay thin: parse params, call lib function, return JSON
- No new dependencies — use native `IntersectionObserver`, no external infinite-scroll library

---

## Boundaries

**Always do:**
- Skip empty days silently (no flash of "no articles" for a day with zero results)
- Preserve the existing grouped-by-date section header format in `NewsList`
- Keep `/api/news` (no params) working unchanged

**Ask before:**
- Adding a Firestore composite index if the `date` range query requires one
- Changing the Firestore date field storage format

**Never do:**
- Load all articles on initial render
- Break client-side filtering/search on already-loaded data
- Add an external infinite scroll library (native IntersectionObserver is sufficient)
