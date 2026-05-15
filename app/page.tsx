"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Loader2 } from "lucide-react"
import { Header } from "@/components/header"
import { SearchBar } from "@/components/search-bar"
import { FilterPanel, type FilterOptions } from "@/components/filter-panel"
import { NewsList } from "@/components/news-list"
import { SummaryDialog } from "@/components/summary-dialog"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import { ThemeProvider } from "@/components/theme-provider"
import { useNewsFilters } from "@/hooks/use-news-filters"
import type { NewsItem } from "@/lib/firebase"

function dayToISODate(d: Date): string {
  return d.toISOString().split("T")[0]
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

export default function HomePage() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [initialError, setInitialError] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState<FilterOptions>({ sort: "date-desc" })
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const filteredNews = useNewsFilters(news, filters, searchQuery)

  const fetchNews = useCallback(async (params: string) => {
    const res = await fetch(`/api/news?${params}`)
    if (!res.ok) throw new Error("Failed to fetch")
    const data: NewsItem[] = await res.json()
    return data.map((item) => ({ ...item, date: new Date(item.date) }))
  }, [])

  // ── Initial load: last 3 days in parallel ────────────────────────────────

  const initFeed = useCallback(async () => {
    setInitialLoading(true)
    setInitialError(false)
    setNews([])
    setHasMore(true)
    try {
      const days = [daysAgo(0), daysAgo(1), daysAgo(2)]
      const results = await Promise.all(days.map((d) => fetchNews(`date=${dayToISODate(d)}`)))
      setNews(results.flat())
    } catch {
      setInitialError(true)
    } finally {
      setInitialLoading(false)
    }
  }, [fetchNews])

  useEffect(() => {
    initFeed()
  }, [initFeed])

  // ── Infinite scroll: load next batch ──────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || news.length === 0) return
    setIsLoadingMore(true)

    const lastItem = news[news.length - 1]
    const before = new Date(lastItem.date).toISOString()

    try {
      const data = await fetchNews(`before=${before}&limit=20`)
      if (data.length > 0) {
        setNews((prev) => [...prev, ...data])
      } else {
        setHasMore(false)
      }
    } catch (error) {
      console.error("Error loading more news:", error)
      setHasMore(false)
    } finally {
      setIsLoadingMore(false)
    }
  }, [news, isLoadingMore, hasMore, fetchNews])

  useEffect(() => {
    if (initialLoading) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore()
      },
      { rootMargin: "200px" } // Load earlier for smoother experience
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore, initialLoading])

  // ── Date range filter override ────────────────────────────────────────────

  useEffect(() => {
    if (filters.dateRange) {
      const { from, to } = filters.dateRange
      fetchNews(`startDate=${from.toISOString()}&endDate=${to.toISOString()}`)
        .then((data) => {
          setNews(data)
          setHasMore(false)
        })
        .catch(() => {})
    } else if (!initialLoading) {
      initFeed()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.dateRange, fetchNews])

  // ── Summarize ─────────────────────────────────────────────────────────────

  const handleSummarize = useCallback((newsItem: NewsItem) => {
    setSelectedNews(newsItem)
    setSummaryDialogOpen(true)
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <div className="min-h-screen bg-background">
        <Header />

        <main className="mx-auto px-4 sm:px-6 py-8 sm:py-10" style={{ maxWidth: "1224px" }}>
          <div className="space-y-8">
            <div className="max-w-xl">
              <SearchBar onSearch={setSearchQuery} placeholder="Search AI news articles…" />
            </div>

            {initialError && (
              <div className="border border-border bg-card flex items-center justify-between px-4 py-3">
                <p className="font-sans text-sm text-foreground">
                  <span className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground mr-3">
                    Error
                  </span>
                  Couldn't load articles. Check your connection and try again.
                </p>
                <button
                  type="button"
                  onClick={initFeed}
                  className="font-sans text-xs text-foreground border border-border px-3 py-1.5 bg-background hover:bg-card active:bg-card focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none transition-colors ml-4 shrink-0"
                  style={{ borderRadius: 0 }}
                >
                  Retry
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1">
                <FilterPanel news={news} onFilter={setFilters} />
              </div>

              <div className="lg:col-span-3">
                {initialLoading ? (
                  <LoadingSkeleton />
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-baseline justify-between border-b border-border pb-3">
                      <h2 className="font-newsreader text-2xl sm:text-3xl text-foreground">
                        {searchQuery ? `Results for "${searchQuery}"` : "Latest AI News"}
                      </h2>
                      <span className="font-sans text-xs text-muted-foreground">
                        {filteredNews.length} of {news.length}
                      </span>
                    </div>

                    <NewsList
                      news={filteredNews}
                      onSummarize={handleSummarize}
                      filters={filters}
                      searchQuery={searchQuery}
                    />

                    <div ref={sentinelRef} />

                    {isLoadingMore && (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}

                    {!hasMore && !isLoadingMore && news.length > 0 && (
                      <p className="font-sans text-xs text-muted-foreground text-center py-8">
                        All articles loaded
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        <SummaryDialog news={selectedNews} open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen} />
      </div>
    </ThemeProvider>
  )
}
