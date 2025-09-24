"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { SearchBar } from "@/components/search-bar"
import { FilterPanel, type FilterOptions } from "@/components/filter-panel"
import { NewsList } from "@/components/news-list"
import { SummaryPanel } from "@/components/summary-panel"
import { SummaryDialog } from "@/components/summary-dialog"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import { ThemeProvider } from "@/components/theme-provider"
import { useNewsFilters } from "@/hooks/use-news-filters"
import type { NewsItem } from "@/lib/firebase"

export default function HomePage() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState<FilterOptions>({
    sortBy: "date",
    sortOrder: "desc",
  })
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false)

  const filteredNews = useNewsFilters(news, filters, searchQuery)

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch("/api/news")
        if (!response.ok) {
          throw new Error("Failed to fetch news")
        }
        const newsData = await response.json()
        setNews(newsData)
      } catch (error) {
        console.error("Error fetching news:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchNews()
  }, [])

  const handleSummarize = (newsItem: NewsItem) => {
    setSelectedNews(newsItem)
    setSummaryDialogOpen(true)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const handleFilter = (newFilters: FilterOptions) => {
    setFilters(newFilters)
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              <SearchBar onSearch={handleSearch} placeholder="Search AI news articles..." />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sidebar */}
              <div className="lg:col-span-1 space-y-6">
                <FilterPanel news={news} onFilter={handleFilter} />
                <SummaryPanel
                  news={filteredNews}
                  selectedDomain={filters.domain}
                  selectedDateRange={filters.dateRange}
                />
              </div>

              {/* Main Content */}
              <div className="lg:col-span-3">
                {loading ? (
                  <LoadingSkeleton />
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-playfair font-semibold">
                        {searchQuery ? `Search results for "${searchQuery}"` : "Latest AI News"}
                      </h2>
                      <div className="text-sm text-muted-foreground">
                        {filteredNews.length} of {news.length} articles
                      </div>
                    </div>
                    <NewsList news={filteredNews} onSummarize={handleSummarize} filters={filters} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Summary Dialog */}
        <SummaryDialog news={selectedNews} open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen} />
      </div>
    </ThemeProvider>
  )
}
