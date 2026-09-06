import { describe, it, expect } from "vitest"
import {
  useClusterFilters,
  type SourceOption,
  parseNewsUrlParams,
  buildNewsQueryString,
  isValidSourceCategory,
  getInitialNewsUrlParams,
} from "../use-news-filters"
import type { Cluster, SourceCategory } from "@/lib/types"

function filter(
  clusters: Cluster[],
  filters: Parameters<typeof useClusterFilters>[1],
  searchQuery = "",
  sources: SourceOption[] = []
) {
  const sourceCategoryMap = new Map<string, SourceCategory>()
  sources.forEach((s) => {
    if (s.category) sourceCategoryMap.set(s.id, s.category)
  })

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

  if (filters.category && filters.category !== "all") {
    const cat = filters.category
    filtered = filtered.filter((c) => {
      if (c.categories?.includes(cat) || c.primaryCategory === cat) return true
      return c.articles.some((a) => {
        const articleCat = a.sourceCategory ?? sourceCategoryMap.get(a.sourceId) ?? "industry-news"
        return articleCat === cat
      })
    })
  }

  if (filters.sourceIds && filters.sourceIds.length > 0) {
    const selectedSet = new Set(filters.sourceIds)
    filtered = filtered.filter((c) => c.articles.some((a) => selectedSet.has(a.sourceId)))
  }

  return filtered
}

describe("useClusterFilters", () => {
  const dummyClusters: Cluster[] = [
    {
      id: "c1",
      summary: "New version of LangChain released",
      primaryCategory: "ai-engineering",
      categories: ["ai-engineering"],
      articles: [
        {
          id: "a1",
          url: "https://langchain.com/blog/v1",
          domain: "langchain.com",
          title: "LangChain Release",
          sourceId: "src-langchain",
          sourceName: "LangChain",
          excerpt: "",
          relevanceScore: 10,
          sourceCategory: "ai-engineering",
        },
      ],
      sentiment: "neutral",
      articleCount: 1,
      isSingleton: true,
      topicTag: "product",
      entities: [],
      publishedAt: new Date(),
      createdAt: new Date(),
    },
    {
      id: "c2",
      summary: "Old news from TechCrunch without category tag",
      articles: [
        {
          id: "a2",
          url: "https://techcrunch.com/article2",
          domain: "techcrunch.com",
          title: "Legacy News",
          sourceId: "src-techcrunch",
          sourceName: "TechCrunch",
          excerpt: "",
          relevanceScore: 5,
        },
      ],
      sentiment: "neutral",
      articleCount: 1,
      isSingleton: true,
      topicTag: "industry",
      entities: [],
      publishedAt: new Date(),
      createdAt: new Date(),
    },
  ]

  const mockSources: SourceOption[] = [
    { id: "src-langchain", name: "LangChain Blog", category: "ai-engineering" },
    { id: "src-techcrunch", name: "TechCrunch", category: "industry-news" },
  ]

  it("filters clusters by category", () => {
    const res = filter(dummyClusters, { sort: "date-desc", category: "ai-engineering" })
    expect(res).toHaveLength(1)
    expect(res[0].id).toBe("c1")
  })

  it("resolves legacy articles via sourceCategoryMap", () => {
    const res = filter(
      dummyClusters,
      { sort: "date-desc", category: "industry-news" },
      "",
      mockSources
    )
    expect(res).toHaveLength(1)
    expect(res[0].id).toBe("c2")
  })

  it("supports multi-choice sourceIds filtering", () => {
    const res = filter(dummyClusters, {
      sort: "date-desc",
      sourceIds: ["src-langchain", "src-techcrunch"],
    })
    expect(res).toHaveLength(2)

    const resSingle = filter(dummyClusters, {
      sort: "date-desc",
      sourceIds: ["src-langchain"],
    })
    expect(resSingle).toHaveLength(1)
    expect(resSingle[0].id).toBe("c1")
  })
})

describe("News URL Parameters Synchronization", () => {
  describe("isValidSourceCategory", () => {
    it("validates known categories", () => {
      expect(isValidSourceCategory("frontier-research")).toBe(true)
      expect(isValidSourceCategory("ai-engineering")).toBe(true)
      expect(isValidSourceCategory("ecosystem-analysis")).toBe(true)
      expect(isValidSourceCategory("industry-news")).toBe(true)
      expect(isValidSourceCategory("genmedia")).toBe(true)
    })

    it("rejects unknown categories", () => {
      expect(isValidSourceCategory("all")).toBe(false)
      expect(isValidSourceCategory("invalid-category")).toBe(false)
      expect(isValidSourceCategory(null)).toBe(false)
      expect(isValidSourceCategory(undefined)).toBe(false)
    })
  })

  describe("parseNewsUrlParams", () => {
    it("parses valid category, search query, and story id", () => {
      const parsed = parseNewsUrlParams("?category=ai-engineering&q=transformers&story=cluster-123")
      expect(parsed).toEqual({
        category: "ai-engineering",
        q: "transformers",
        story: "cluster-123",
      })
    })

    it("falls back to all when category is missing or invalid", () => {
      const parsedMissing = parseNewsUrlParams("?q=claude")
      expect(parsedMissing.category).toBe("all")
      expect(parsedMissing.q).toBe("claude")
      expect(parsedMissing.story).toBeNull()

      const parsedInvalid = parseNewsUrlParams("?category=nonexistent")
      expect(parsedInvalid.category).toBe("all")
    })

    it("trims whitespace from queries and stories", () => {
      const parsed = parseNewsUrlParams("?q=%20%20gemini%20%20&story=%20c456%20")
      expect(parsed.q).toBe("gemini")
      expect(parsed.story).toBe("c456")
    })

    it("handles URLSearchParams object and empty strings", () => {
      const params = new URLSearchParams()
      params.set("category", "genmedia")
      const parsed = parseNewsUrlParams(params)
      expect(parsed.category).toBe("genmedia")
      expect(parsed.q).toBe("")
      expect(parsed.story).toBeNull()
    })
  })

  describe("buildNewsQueryString", () => {
    it("serializes category, search query, and story id", () => {
      const qs = buildNewsQueryString({
        category: "frontier-research",
        q: "deepseek",
        story: "cluster-789",
      })
      expect(qs).toBe("category=frontier-research&q=deepseek&story=cluster-789")
    })

    it("omits category when set to all or empty", () => {
      const qs = buildNewsQueryString({
        category: "all",
        q: "attention",
      })
      expect(qs).toBe("q=attention")
    })

    it("removes query and story when cleared", () => {
      const initial = "?category=industry-news&q=old&story=c1"
      const updated = buildNewsQueryString(
        {
          q: "",
          story: null,
        },
        initial
      )
      expect(updated).toBe("category=industry-news")
    })
  })

  describe("getInitialNewsUrlParams", () => {
    it("returns safe defaults in node/SSR environment without window", () => {
      const defaults = getInitialNewsUrlParams()
      expect(defaults).toEqual({
        category: "all",
        q: "",
        story: null,
      })
    })
  })
})
