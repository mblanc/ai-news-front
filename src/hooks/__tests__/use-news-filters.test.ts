import { describe, it, expect } from "vitest"
import { useClusterFilters, type SourceOption } from "../use-news-filters"
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
