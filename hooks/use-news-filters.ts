"use client"

import { useMemo } from "react"
import type { NewsItem } from "@/lib/firebase"
import type { FilterOptions } from "@/components/filter-panel"

export function useNewsFilters(news: NewsItem[], filters: FilterOptions, searchQuery: string) {
  return useMemo(() => {
    let filteredNews = [...news]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filteredNews = filteredNews.filter(
        (item) => item.title.toLowerCase().includes(query) || item.domain.toLowerCase().includes(query),
      )
    }

    if (filters.domain) {
      filteredNews = filteredNews.filter((item) => item.domain === filters.domain)
    }

    if (filters.dateRange) {
      filteredNews = filteredNews.filter((item) => {
        const itemDate = new Date(item.date)
        return itemDate >= filters.dateRange!.from && itemDate <= filters.dateRange!.to
      })
    }

    const sortValue = filters.sort || "date-desc"
    const [sortBy, sortOrder] = sortValue.split("-") as ["date" | "domain", "asc" | "desc"]

    filteredNews.sort((a, b) => {
      const comparison =
        sortBy === "domain"
          ? a.domain.localeCompare(b.domain)
          : a.date.getTime() - b.date.getTime()
      return sortOrder === "desc" ? -comparison : comparison
    })

    return filteredNews
  }, [news, filters, searchQuery])
}
