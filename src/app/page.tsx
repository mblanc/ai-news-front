"use client"

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react"
import { Header } from "@/components/header"
import { CategoryNav } from "@/components/category-nav"
import { SearchBar } from "@/components/search-bar"
import { FilterPanel, type FilterOptions } from "@/components/filter-panel"
import { NewsList } from "@/components/news-list"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import {
  useClusterFilters,
  useNewsUrlSync,
  getInitialNewsUrlParams,
  type SourceOption,
} from "@/hooks/use-news-filters"
import dynamic from "next/dynamic"
import { DailyDigest } from "@/components/daily-digest"
import type { Cluster, SourceCategory } from "@/lib/types"

const KeyboardShortcutsModal = dynamic(
  () => import("@/components/keyboard-shortcuts-modal").then((m) => m.KeyboardShortcutsModal),
  { ssr: false }
)

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

function NewsHomeContent() {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [oldestDay, setOldestDay] = useState<Date | null>(null)
  const [hasMore, setHasMore] = useState(true)

  // Initialize state with URL query parameters if present
  const [searchQuery, setSearchQuery] = useState(() => getInitialNewsUrlParams().q)
  const [sources, setSources] = useState<SourceOption[]>([])
  const [filters, setFilters] = useState<FilterOptions>(() => ({
    sort: "date-desc",
    category: getInitialNewsUrlParams().category,
  }))
  const [storyIdParam, setStoryIdParam] = useState<string | null>(
    () => getInitialNewsUrlParams().story
  )
  const [fetchedCluster, setFetchedCluster] = useState<Cluster | null>(null)

  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)

  // Derived open cluster based on active story ID parameter
  const selectedCluster = useMemo(() => {
    if (!storyIdParam) return null
    return (
      clusters.find((c) => c.id === storyIdParam) ??
      (fetchedCluster?.id === storyIdParam ? fetchedCluster : null)
    )
  }, [storyIdParam, clusters, fetchedCluster])

  // Synchronize category, search query, and story parameters with URL
  useNewsUrlSync({
    category: filters.category || "all",
    onCategoryChange: useCallback((cat) => setFilters((f) => ({ ...f, category: cat })), []),
    searchQuery,
    onSearchChange: setSearchQuery,
    storyId: storyIdParam,
    onStoryChange: setStoryIdParam,
  })

  // Deep-link story resolution: fetch on-demand if cluster is not in the recent batch
  useEffect(() => {
    if (!storyIdParam) return
    const match = clusters.find((c) => c.id === storyIdParam)
    if (match || loading || clusters.length === 0) return

    let active = true
    fetch(`/api/clusters?id=${encodeURIComponent(storyIdParam)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Cluster[]) => {
        if (!active || !data || data.length === 0) return
        const fetched = {
          ...data[0],
          createdAt: new Date(data[0].createdAt),
          publishedAt: new Date(data[0].publishedAt),
        }
        setFetchedCluster(fetched)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [storyIdParam, clusters, loading])

  const filteredClusters = useClusterFilters(clusters, filters, searchQuery, sources)

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<SourceCategory | "all", number>> = {
      all: clusters.length,
    }
    for (const c of clusters) {
      const cats = c.categories || (c.primaryCategory ? [c.primaryCategory] : [])
      for (const cat of cats) {
        counts[cat] = (counts[cat] || 0) + 1
      }
    }
    return counts
  }, [clusters])

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

  const handleResetFilters = useCallback(() => {
    setFilters({ sort: "date-desc", category: "all" })
    setSearchQuery("")
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName || ""
      const isInputActive = ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)
      if (isInputActive) return

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault()
        setShortcutsOpen((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-background transition-colors">
      <Header />
      <CategoryNav
        activeCategory={filters.category || "all"}
        onSelectCategory={(cat) => setFilters((f) => ({ ...f, category: cat }))}
        clusterCounts={categoryCounts}
      />

      <main id="main-content" className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-6">
        <div className="space-y-4">
          <div className="max-w-xl">
            <SearchBar
              value={searchQuery}
              onSearch={setSearchQuery}
              placeholder="Search stories, models, research…"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 flex items-center justify-between p-3 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-destructive text-destructive-foreground px-2 py-0.5 font-sans text-[11px] font-semibold">
                  Error
                </span>
                <p className="font-sans text-xs text-foreground">
                  Couldn&apos;t load stories. Please verify your connection.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                className="font-sans text-xs font-medium text-foreground bg-card hover:bg-muted border border-border px-3 py-1 rounded-full transition-all shadow-xs shrink-0 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            <div className="lg:col-span-1 lg:sticky lg:top-[116px] lg:self-start">
              <FilterPanel
                sources={sources}
                filters={filters}
                onFilter={setFilters}
                onReset={handleResetFilters}
              />
            </div>

            <div className="lg:col-span-3">
              {loading ? (
                <LoadingSkeleton />
              ) : (
                <div className="space-y-4">
                  {!searchQuery && <DailyDigest category={filters.category} />}

                  <div className="flex items-baseline justify-between border-b border-border/60 pb-2">
                    <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-foreground">
                      {searchQuery ? `Results for "${searchQuery}"` : "Synthesized AI Stories"}
                    </h2>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShortcutsOpen(true)}
                        title="View keyboard shortcuts (or press ?)"
                        aria-label="View keyboard shortcuts cheatsheet"
                        className="hidden md:flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/80 hover:text-foreground bg-muted/40 hover:bg-muted/80 px-2.5 py-1 rounded-full border border-border/60 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      >
                        <span>Nav:</span>
                        <kbd className="px-1 py-0.2 rounded bg-card border border-border text-[9px] font-semibold text-foreground">
                          J
                        </kbd>
                        <kbd className="px-1 py-0.2 rounded bg-card border border-border text-[9px] font-semibold text-foreground">
                          K
                        </kbd>
                        <span className="ml-1">Open:</span>
                        <kbd className="px-1 py-0.2 rounded bg-card border border-border text-[9px] font-semibold text-foreground">
                          Enter
                        </kbd>
                        <kbd className="ml-1 px-1 py-0.2 rounded bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary">
                          ?
                        </kbd>
                      </button>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {filteredClusters.length} of {clusters.length}
                      </span>
                    </div>
                  </div>

                  <NewsList
                    clusters={filteredClusters}
                    filters={filters}
                    searchQuery={searchQuery}
                    onResetFilters={handleResetFilters}
                    selectedCluster={selectedCluster}
                    onSelectCluster={(cluster) => {
                      setStoryIdParam(cluster?.id ?? null)
                    }}
                  />

                  <div ref={sentinelRef} className="h-1" />

                  {loadingMore && (
                    <div className="flex items-center justify-center gap-2.5 py-4">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                      <span className="font-sans text-xs font-medium text-muted-foreground">
                        Loading more stories…
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <KeyboardShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <NewsHomeContent />
    </Suspense>
  )
}
