"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Header } from "@/components/header"
import { SearchBar } from "@/components/search-bar"
import { FilterPanel, type FilterOptions } from "@/components/filter-panel"
import { NewsList } from "@/components/news-list"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import { ThemeProvider } from "@/components/theme-provider"
import { useClusterFilters, type SourceOption } from "@/hooks/use-news-filters"
import { DailyDigest } from "@/components/daily-digest"
import type { Cluster, SourceCategory } from "@/lib/types"

function dayStart(d: Date): Date {
  const s = new Date(d)
  s.setUTCHours(0, 0, 0, 0)
  return s
}

function subtractDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() - n)
  return r
}

async function fetchClustersForRange(start: Date, end: Date): Promise<Cluster[]> {
  const params = new URLSearchParams({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  })
  const res = await fetch(`/api/clusters?${params}`)
  if (!res.ok) throw new Error("Failed to fetch")
  const data: Cluster[] = await res.json()
  return data.map((c) => ({
    ...c,
    createdAt: new Date(c.createdAt),
    publishedAt: new Date(c.publishedAt),
  }))
}

export default function HomePage() {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [oldestDay, setOldestDay] = useState<Date | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sources, setSources] = useState<SourceOption[]>([])
  const [filters, setFilters] = useState<FilterOptions>({ sort: "date-desc", category: "all" })
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)

  const filteredClusters = useClusterFilters(clusters, filters, searchQuery, sources)

  useEffect(() => {
    fetch("/api/sources")
      .then((r) => (r.ok ? r.json() : { sources: [] }))
      .then(
        ({
          sources: srcs,
        }: {
          sources: Array<{ id: string; name: string; category?: SourceCategory; enabled: boolean }>
        }) => {
          setSources(
            srcs
              .filter((s) => s.enabled)
              .map((s) => ({ id: s.id, name: s.name, category: s.category }))
          )
        }
      )
      .catch(() => {})
  }, [])

  const fetchInitialData = useCallback(async () => {
    const now = new Date()
    const start = dayStart(subtractDays(now, 2))
    const data = await fetchClustersForRange(start, now)
    return { data, start }
  }, [])

  const handleRetry = useCallback(() => {
    setLoading(true)
    setError(false)
    fetchInitialData()
      .then(({ data, start }) => {
        setClusters(data)
        setOldestDay(start)
        setError(false)
      })
      .catch(() => {
        setError(true)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [fetchInitialData])

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !oldestDay || !hasMore) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const end = new Date(oldestDay.getTime() - 1)
      const start = dayStart(subtractDays(oldestDay, 1))
      const data = await fetchClustersForRange(start, end)
      if (data.length === 0) {
        setHasMore(false)
        return
      }
      setClusters((prev) => {
        const existingIds = new Set(prev.map((c) => c.id))
        return [...prev, ...data.filter((c) => !existingIds.has(c.id))]
      })
      setOldestDay(start)
    } catch {
      setError(true)
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [oldestDay, hasMore])

  useEffect(() => {
    let active = true
    fetchInitialData()
      .then(({ data, start }) => {
        if (!active) return
        setClusters(data)
        setOldestDay(start)
        setError(false)
      })
      .catch(() => {
        if (!active) return
        setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [fetchInitialData])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { rootMargin: "200px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <div className="min-h-screen bg-background">
        <Header />

        <main className="mx-auto px-4 sm:px-6 py-8 sm:py-10" style={{ maxWidth: "1224px" }}>
          <div className="space-y-8">
            <div className="max-w-xl">
              <SearchBar onSearch={setSearchQuery} placeholder="Search stories…" />
            </div>

            {error && (
              <div className="border border-border bg-card flex items-center justify-between px-4 py-3">
                <p className="font-sans text-sm text-foreground">
                  <span className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground mr-3">
                    Error
                  </span>
                  Couldn&apos;t load stories. Check your connection and try again.
                </p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="font-sans text-xs text-foreground border border-border px-3 py-1.5 bg-background hover:bg-card transition-colors ml-4 shrink-0"
                  style={{ borderRadius: 0 }}
                >
                  Retry
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1">
                <FilterPanel sources={sources} onFilter={setFilters} />
              </div>

              <div className="lg:col-span-3">
                {loading ? (
                  <LoadingSkeleton />
                ) : (
                  <div className="space-y-6">
                    {!searchQuery && (
                      <DailyDigest
                        category={filters.category}
                        onCategoryChange={(cat) => setFilters((f) => ({ ...f, category: cat }))}
                      />
                    )}

                    <div className="flex items-baseline justify-between border-b border-border pb-3">
                      <h2 className="font-newsreader text-2xl sm:text-3xl text-foreground">
                        {searchQuery ? `Results for "${searchQuery}"` : "Latest AI Stories"}
                      </h2>
                      <span className="font-sans text-xs text-muted-foreground">
                        {filteredClusters.length} of {clusters.length}
                      </span>
                    </div>

                    <NewsList
                      clusters={filteredClusters}
                      filters={filters}
                      searchQuery={searchQuery}
                    />

                    <div ref={sentinelRef} className="h-1" />

                    {loadingMore && (
                      <div className="flex items-center gap-3 py-4">
                        <div className="h-px flex-1 bg-border" />
                        <span className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">
                          Loading
                        </span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </ThemeProvider>
  )
}
