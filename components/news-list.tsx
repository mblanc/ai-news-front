"use client"

import { useState, useMemo } from "react"
import { ExternalLink } from "lucide-react"
import { DomainIcon } from "@/components/domain-icon"
import { formatDate, formatDateLong } from "@/lib/format-date"
import type { NewsItem } from "@/lib/firebase"
import type { FilterOptions } from "@/components/filter-panel"

interface NewsListProps {
  news: NewsItem[]
  onSummarize?: (news: NewsItem) => void
  filters: FilterOptions
  searchQuery?: string
}

interface GroupedNews {
  [key: string]: NewsItem[]
}

export function NewsList({ news, onSummarize, filters, searchQuery }: NewsListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleSummarize = async (newsItem: NewsItem) => {
    setLoadingId(newsItem.id)
    try {
      await onSummarize?.(newsItem)
    } finally {
      setLoadingId(null)
    }
  }

  const [sortBy] = filters.sort.split("-") as ["date" | "domain", "asc" | "desc"]

  const groupNewsBySection = (news: NewsItem[]): GroupedNews => {
    const grouped: GroupedNews = {}
    news.forEach((item) => {
      const key = sortBy === "domain" ? item.domain : formatDateLong(item.date)
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(item)
    })
    return grouped
  }

  const sortSections = (grouped: GroupedNews): string[] => {
    const [, sortOrder] = filters.sort.split("-") as ["date" | "domain", "asc" | "desc"]
    return Object.keys(grouped).sort((a, b) => {
      const cmp = sortBy === "domain" ? a.localeCompare(b) : new Date(a).getTime() - new Date(b).getTime()
      return sortOrder === "asc" ? cmp : -cmp
    })
  }

  if (news.length === 0) {
    return (
      <div className="border border-border py-16 px-8">
        <p className="font-sans text-lg text-muted-foreground">
          {searchQuery ? `No results for \u201c${searchQuery}\u201d` : "No articles match the current filters."}
        </p>
        <p className="font-sans text-sm text-muted-foreground mt-2">
          {searchQuery
            ? "Try a shorter or broader search term."
            : "Try adjusting your filters or clearing the date range."}
        </p>
      </div>
    )
  }

  const groupedNews = useMemo(() => groupNewsBySection(news), [news, sortBy])
  const sortedSectionKeys = useMemo(() => sortSections(groupedNews), [groupedNews, filters.sort, sortBy])

  return (
    <div className="space-y-10">
      {sortedSectionKeys.map((sectionKey) => (
        <div key={sectionKey}>
          <div className="border-b border-border pb-2 mb-0">
            {sortBy === "domain" && (
              <span className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground block mb-0.5">
                Source
              </span>
            )}
            <div className="flex items-baseline justify-between">
              <h3 className="font-newsreader text-xl sm:text-2xl text-foreground leading-tight">
                {sectionKey}
              </h3>
              <span className="font-sans text-xs text-muted-foreground">
                {groupedNews[sectionKey].length} article
                {groupedNews[sectionKey].length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div>
            {groupedNews[sectionKey].map((item) => (
              <div
                key={item.id}
                className="group border-b border-border py-4 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-newsreader text-lg leading-snug text-foreground group-hover:text-muted-foreground transition-colors">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-4 mt-1.5 font-sans text-xs text-muted-foreground">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none"
                      >
                        <DomainIcon domain={item.domain} />
                        {item.domain}
                      </a>
                      <span>{formatDate(item.date)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open "${item.title}" in new tab`}
                      className="p-3 text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    {onSummarize && (
                      <button
                        type="button"
                        onClick={() => handleSummarize(item)}
                        disabled={loadingId === item.id}
                        className="font-sans text-xs leading-none px-4 py-2.5 border border-border bg-background hover:bg-card active:bg-card active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed transition-[transform,colors] duration-150"
                        style={{ borderRadius: 0 }}
                      >
                        {loadingId === item.id ? "Summarizing\u2026" : "Summarize"}
                      </button>
                    )}
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
