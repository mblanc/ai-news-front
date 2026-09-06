"use client"

import { useMemo, useEffect, useRef } from "react"
import type { Cluster, SourceCategory } from "@/lib/types"
import type { FilterOptions } from "@/components/filter-panel"

export const VALID_SOURCE_CATEGORIES: ReadonlyArray<SourceCategory> = [
  "frontier-research",
  "ai-engineering",
  "ecosystem-analysis",
  "industry-news",
  "genmedia",
] as const

export function isValidSourceCategory(val: unknown): val is SourceCategory {
  return typeof val === "string" && (VALID_SOURCE_CATEGORIES as readonly string[]).includes(val)
}

export interface NewsUrlParams {
  category: SourceCategory | "all"
  q: string
  story: string | null
}

export function parseNewsUrlParams(
  search: string | URLSearchParams | { get: (key: string) => string | null }
): NewsUrlParams {
  let params: { get: (key: string) => string | null }
  if (typeof search === "string") {
    const searchString = search.startsWith("?") ? search.slice(1) : search
    params = new URLSearchParams(searchString)
  } else {
    params = search
  }

  const rawCat = params.get("category")
  const category: SourceCategory | "all" = isValidSourceCategory(rawCat) ? rawCat : "all"
  const q = (params.get("q") || "").trim()
  const rawStory = params.get("story")
  const story = rawStory && rawStory.trim() ? rawStory.trim() : null

  return { category, q, story }
}

export function buildNewsQueryString(
  updates: Partial<NewsUrlParams>,
  currentSearch?: string | URLSearchParams
): string {
  let params: URLSearchParams
  if (!currentSearch) {
    params = new URLSearchParams()
  } else if (typeof currentSearch === "string") {
    params = new URLSearchParams(
      currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch
    )
  } else {
    params = new URLSearchParams(currentSearch.toString())
  }

  if (updates.category !== undefined) {
    if (updates.category && updates.category !== "all" && isValidSourceCategory(updates.category)) {
      params.set("category", updates.category)
    } else {
      params.delete("category")
    }
  }

  if (updates.q !== undefined) {
    const trimmed = updates.q.trim()
    if (trimmed) {
      params.set("q", trimmed)
    } else {
      params.delete("q")
    }
  }

  if (updates.story !== undefined) {
    const trimmed = updates.story?.trim()
    if (trimmed) {
      params.set("story", trimmed)
    } else {
      params.delete("story")
    }
  }

  return params.toString()
}

export function getInitialNewsUrlParams(): NewsUrlParams {
  if (typeof window === "undefined") {
    return { category: "all", q: "", story: null }
  }
  return parseNewsUrlParams(window.location.search)
}

export interface UseNewsUrlSyncOptions {
  category: SourceCategory | "all"
  onCategoryChange: (cat: SourceCategory | "all") => void
  searchQuery: string
  onSearchChange: (q: string) => void
  storyId?: string | null
  onStoryChange?: (storyId: string | null) => void
}

export function useNewsUrlSync({
  category,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  storyId,
  onStoryChange,
}: UseNewsUrlSyncOptions) {
  const categoryRef = useRef(category)
  const searchQueryRef = useRef(searchQuery)
  const storyIdRef = useRef(storyId)
  const onCategoryChangeRef = useRef(onCategoryChange)
  const onSearchChangeRef = useRef(onSearchChange)
  const onStoryChangeRef = useRef(onStoryChange)

  useEffect(() => {
    categoryRef.current = category
    searchQueryRef.current = searchQuery
    storyIdRef.current = storyId
    onCategoryChangeRef.current = onCategoryChange
    onSearchChangeRef.current = onSearchChange
    onStoryChangeRef.current = onStoryChange
  })

  // Listen to popstate (browser back/forward navigation)
  useEffect(() => {
    if (typeof window === "undefined") return

    const handlePopState = () => {
      const parsed = parseNewsUrlParams(window.location.search)
      if (parsed.category !== categoryRef.current) {
        onCategoryChangeRef.current(parsed.category)
      }
      if (parsed.q !== searchQueryRef.current) {
        onSearchChangeRef.current(parsed.q)
      }
      if (parsed.story !== (storyIdRef.current ?? null)) {
        onStoryChangeRef.current?.(parsed.story)
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  // Synchronize category and search query state to URL
  useEffect(() => {
    if (typeof window === "undefined") return

    const currentParams = new URLSearchParams(window.location.search)
    const currentCat = currentParams.get("category") || "all"
    const currentQ = (currentParams.get("q") || "").trim()

    const targetCat = category || "all"
    const targetQ = searchQuery.trim()

    if (currentCat !== targetCat || currentQ !== targetQ) {
      if (targetCat === "all") {
        currentParams.delete("category")
      } else {
        currentParams.set("category", targetCat)
      }

      if (!targetQ) {
        currentParams.delete("q")
      } else {
        currentParams.set("q", targetQ)
      }

      const qs = currentParams.toString()
      const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
      const currentFull = `${window.location.pathname}${window.location.search}`
      if (newUrl !== currentFull) {
        window.history.replaceState(window.history.state, "", newUrl)
      }
    }
  }, [category, searchQuery])
}

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
      const fromTime = filters.dateRange.from.getTime()
      const toTime = filters.dateRange.to.getTime()
      filtered = filtered.filter((c) => {
        const t =
          c.publishedAt instanceof Date
            ? c.publishedAt.getTime()
            : new Date(c.publishedAt).getTime()
        return t >= fromTime && t <= toTime
      })
    }

    // 5. Sorting
    const [sortBy, sortOrder] = (filters.sort || "date-desc").split("-") as [
      "date" | "domain",
      "asc" | "desc",
    ]

    filtered.sort((a, b) => {
      if (sortBy === "domain") {
        const primaryA = a.articles[0]?.domain ?? ""
        const primaryB = b.articles[0]?.domain ?? ""
        const cmp = primaryA.localeCompare(primaryB)
        return sortOrder === "desc" ? -cmp : cmp
      }
      const timeA =
        a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()
      const timeB =
        b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()
      const cmp = timeA - timeB
      return sortOrder === "desc" ? -cmp : cmp
    })

    return filtered
  }, [clusters, filters, searchQuery, sourceCategoryMap])
}
