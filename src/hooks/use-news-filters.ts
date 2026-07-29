"use client"

import { useMemo } from "react"
import type { Cluster, SourceCategory } from "@/lib/types"
import type { FilterOptions } from "@/components/filter-panel"

export interface SourceOption {
  id: string
  name: string
  category?: SourceCategory
}

export function useClusterFilters(
  clusters: Cluster[],
  filters: FilterOptions,
  searchQuery: string,
  sources: SourceOption[] = []
) {
  const sourceCategoryMap = useMemo(() => {
    const map = new Map<string, SourceCategory>()
    sources.forEach((s) => {
      if (s.category) map.set(s.id, s.category)
    })
    return map
  }, [sources])

  return useMemo(() => {
    let filtered = [...clusters]

    // 1. Search Query Filter
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

    // 2. Category Filter (with legacy source lookup)
    if (filters.category && filters.category !== "all") {
      const cat = filters.category
      filtered = filtered.filter((c) => {
        if (c.categories?.includes(cat) || c.primaryCategory === cat) return true
        return c.articles.some((a) => {
          const articleCat =
            a.sourceCategory ?? sourceCategoryMap.get(a.sourceId) ?? "industry-news"
          return articleCat === cat
        })
      })
    }

    // 3. Multi-Choice Sources Filter
    if (filters.sourceIds && filters.sourceIds.length > 0) {
      const selectedSet = new Set(filters.sourceIds)
      filtered = filtered.filter((c) => c.articles.some((a) => selectedSet.has(a.sourceId)))
    } else if (filters.sourceId) {
      // Legacy single source fallback
      filtered = filtered.filter((c) => c.articles.some((a) => a.sourceId === filters.sourceId))
    }

    // 4. Date Range Filter
    if (filters.dateRange) {
      filtered = filtered.filter((c) => {
        const d = new Date(c.publishedAt)
        return d >= filters.dateRange!.from && d <= filters.dateRange!.to
      })
    }

    // 5. Sorting
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
  }, [clusters, filters, searchQuery, sourceCategoryMap])
}
