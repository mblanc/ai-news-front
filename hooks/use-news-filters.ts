"use client"

import { useMemo } from "react"
import type { Cluster } from "@/lib/types"
import type { FilterOptions } from "@/components/filter-panel"

export function useClusterFilters(
  clusters: Cluster[],
  filters: FilterOptions,
  searchQuery: string
) {
  return useMemo(() => {
    let filtered = [...clusters]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          c.summary.toLowerCase().includes(query) ||
          c.articles.some(
            (a) => a.title.toLowerCase().includes(query) || a.domain.toLowerCase().includes(query)
          )
      )
    }

    if (filters.domain) {
      filtered = filtered.filter((c) => c.articles.some((a) => a.domain === filters.domain))
    }

    if (filters.dateRange) {
      filtered = filtered.filter((c) => {
        const d = new Date(c.publishedAt)
        return d >= filters.dateRange!.from && d <= filters.dateRange!.to
      })
    }

    const [sortBy, sortOrder] = (filters.sort || "date-desc").split("-") as [
      "date" | "domain",
      "asc" | "desc",
    ]

    filtered.sort((a, b) => {
      const primaryA = a.articles[0]?.domain ?? ""
      const primaryB = b.articles[0]?.domain ?? ""
      const comparison =
        sortBy === "domain"
          ? primaryA.localeCompare(primaryB)
          : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sortOrder === "desc" ? -comparison : comparison
    })

    return filtered
  }, [clusters, filters, searchQuery])
}
