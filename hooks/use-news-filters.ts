"use client"

import { useMemo } from "react"
import type { NewsItem } from "@/lib/firebase"
import type { FilterOptions } from "@/components/filter-panel"

export function useNewsFilters(news: NewsItem[], filters: FilterOptions, searchQuery: string) {
  return useMemo(() => {
    let filteredNews = [...news]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filteredNews = filteredNews.filter(
        (item) => item.title.toLowerCase().includes(query) || item.domain.toLowerCase().includes(query),
      )
    }

    // Apply domain filter
    if (filters.domain) {
      filteredNews = filteredNews.filter((item) => item.domain === filters.domain)
    }

    // Apply date range filter
    if (filters.dateRange) {
      filteredNews = filteredNews.filter((item) => {
        const itemDate = new Date(item.date)
        return itemDate >= filters.dateRange!.from && itemDate <= filters.dateRange!.to
      })
    }

    // Apply sorting
    filteredNews.sort((a, b) => {
      let comparison = 0

      if (filters.sortBy === "date") {
        const dateA = new Date(a.date)
        const dateB = new Date(b.date)
        comparison = dateA.getTime() - dateB.getTime()
      } else if (filters.sortBy === "domain") {
        comparison = a.domain.localeCompare(b.domain)
      }

      return filters.sortOrder === "desc" ? -comparison : comparison
    })

    return filteredNews
  }, [news, filters, searchQuery])
}
