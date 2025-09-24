"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ExternalLink, Calendar, Globe } from "lucide-react"
import type { NewsItem } from "@/lib/firebase"
import type { FilterOptions } from "@/components/filter-panel"

interface NewsListProps {
  news: NewsItem[]
  onSummarize?: (news: NewsItem) => void
  filters: FilterOptions
}

interface GroupedNews {
  [key: string]: NewsItem[]
}

export function NewsList({ news, onSummarize, filters }: NewsListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleSummarize = async (newsItem: NewsItem) => {
    setLoadingId(newsItem.id)
    try {
      await onSummarize?.(newsItem)
    } finally {
      setLoadingId(null)
    }
  }

  const formatDate = (timestamp: any) => {
    try {
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) {
        return "Unknown date"
      }
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    } catch (error) {
      return "Unknown date"
    }
  }

  const formatDateForGrouping = (timestamp: any) => {
    try {
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) {
        return "Unknown date"
      }
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    } catch (error) {
      return "Unknown date"
    }
  }

  const groupNewsBySection = (news: NewsItem[]): GroupedNews => {
    const grouped: GroupedNews = {}
    
    news.forEach((item) => {
      let sectionKey: string
      
      if (filters.sortBy === "domain") {
        sectionKey = item.domain
      } else {
        // Group by date
        sectionKey = formatDateForGrouping(item.date)
      }
      
      if (!grouped[sectionKey]) {
        grouped[sectionKey] = []
      }
      grouped[sectionKey].push(item)
    })
    
    return grouped
  }

  const sortSections = (grouped: GroupedNews): string[] => {
    const sectionKeys = Object.keys(grouped)
    
    if (filters.sortBy === "domain") {
      return sectionKeys.sort((a, b) => {
        return filters.sortOrder === "asc" ? a.localeCompare(b) : b.localeCompare(a)
      })
    } else {
      // Sort by date
      return sectionKeys.sort((a, b) => {
        const dateA = new Date(a)
        const dateB = new Date(b)
        return filters.sortOrder === "asc" ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime()
      })
    }
  }

  if (news.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground text-lg">No news articles found</div>
        <p className="text-sm text-muted-foreground mt-2">Try adjusting your search or filters</p>
      </div>
    )
  }

  const groupedNews = groupNewsBySection(news)
  const sortedSectionKeys = sortSections(groupedNews)

  return (
    <div className="space-y-8">
      {sortedSectionKeys.map((sectionKey) => (
        <div key={sectionKey} className="space-y-4">
          {/* Section Header */}
          <div className="border-b border-border pb-2">
            <h3 className="text-lg font-playfair font-semibold text-foreground">
              {sectionKey}
            </h3>
            <p className="text-sm text-muted-foreground">
              {groupedNews[sectionKey].length} article{groupedNews[sectionKey].length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* News Items in this Section */}
          <div className="space-y-3">
            {groupedNews[sectionKey].map((item) => (
              <div
                key={item.id}
                className="group flex items-start justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          <Globe className="h-3 w-3" />
                          <span className="underline">{item.domain}</span>
                        </a>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(item.date)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-primary">
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      {onSummarize && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSummarize(item)}
                          disabled={loadingId === item.id}
                          className="text-xs"
                        >
                          {loadingId === item.id ? "Summarizing..." : "Summarize"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}


