import { describe, it, expect, vi } from "vitest"

// cluster.ts instantiates GoogleGenAI at module level — mock it to avoid credential errors in tests
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {}
  },
}))

import { cosineSimilarity, clusterArticles, toClusterArticle } from "../cluster"
import type { ArticleWithEmbedding } from "../cluster"

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1)
  })

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1)
  })

  it("returns 0 for a zero vector", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0)
  })

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0)
  })

  it("is symmetric", () => {
    const a = [0.3, 0.7, 0.1]
    const b = [0.5, 0.2, 0.9]
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a))
  })

  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 2], [1])).toBe(0)
  })
})

function makeArticle(id: string, embedding: number[]): ArticleWithEmbedding {
  return {
    id,
    title: id,
    url: `https://example.com/${id}`,
    domain: "example.com",
    sourceId: "source-1",
    sourceName: "Example",
    excerpt: "",
    relevanceScore: 7,
    embedding,
  }
}

describe("clusterArticles", () => {
  it("returns an empty array for empty input", () => {
    expect(clusterArticles([])).toEqual([])
  })

  it("places a single article in a singleton cluster", () => {
    const clusters = clusterArticles([makeArticle("a", [1, 0])])
    expect(clusters).toHaveLength(1)
    expect(clusters[0].isSingleton).toBe(true)
    expect(clusters[0].articles).toHaveLength(1)
  })

  it("groups two very similar articles into one cluster", () => {
    // [1, 0.01] and [1, 0.02] are nearly identical — cosine similarity ≈ 1
    const clusters = clusterArticles([makeArticle("a", [1, 0.01]), makeArticle("b", [1, 0.02])])
    expect(clusters).toHaveLength(1)
    expect(clusters[0].isSingleton).toBe(false)
    expect(clusters[0].articles).toHaveLength(2)
  })

  it("puts orthogonal articles into separate clusters", () => {
    // [1, 0] and [0, 1] have cosine similarity = 0, well below 0.82
    const clusters = clusterArticles([makeArticle("a", [1, 0]), makeArticle("b", [0, 1])])
    expect(clusters).toHaveLength(2)
    expect(clusters.every((c) => c.isSingleton)).toBe(true)
  })

  it("updates isSingleton to false when a second article joins a cluster", () => {
    const clusters = clusterArticles([
      makeArticle("a", [1, 0.01]),
      makeArticle("b", [1, 0.02]),
      makeArticle("c", [0, 1]), // orthogonal — own cluster
    ])
    const nonSingleton = clusters.filter((c) => !c.isSingleton)
    expect(nonSingleton).toHaveLength(1)
    expect(nonSingleton[0].articles).toHaveLength(2)
  })

  it("preserves all article ids across clusters", () => {
    const articles = [
      makeArticle("a", [1, 0]),
      makeArticle("b", [0, 1]),
      makeArticle("c", [1, 0.01]),
    ]
    const clusters = clusterArticles(articles)
    const allIds = clusters.flatMap((c) => c.articles.map((a) => a.id)).sort()
    expect(allIds).toEqual(["a", "b", "c"].sort())
  })
})

describe("toClusterArticle", () => {
  it("strips embedding and bodyMd while keeping only ClusterArticle fields", () => {
    const bloated = {
      id: "art-1",
      title: "Title 1",
      url: "https://example.com/1",
      domain: "example.com",
      sourceId: "src-1",
      sourceName: "Source 1",
      sourceCategory: "ai-engineering" as const,
      excerpt: "Short excerpt",
      relevanceScore: 8,
      embedding: [0.1, 0.2, 0.3],
      bodyMd: "# Very long content".repeat(1000),
    }

    const sanitized = toClusterArticle(bloated as unknown as ArticleWithEmbedding)
    expect(sanitized).toEqual({
      id: "art-1",
      title: "Title 1",
      url: "https://example.com/1",
      domain: "example.com",
      sourceId: "src-1",
      sourceName: "Source 1",
      sourceCategory: "ai-engineering",
      excerpt: "Short excerpt",
      relevanceScore: 8,
    })
    expect("embedding" in sanitized).toBe(false)
    expect("bodyMd" in sanitized).toBe(false)
  })

  it("truncates excessively long excerpts to 500 characters and handles missing fields", () => {
    const minimal = {
      id: "art-2",
      excerpt: "a".repeat(800),
    }

    const sanitized = toClusterArticle(minimal as unknown as ArticleWithEmbedding)
    expect(sanitized.id).toBe("art-2")
    expect(sanitized.title).toBe("")
    expect(sanitized.url).toBe("")
    expect(sanitized.domain).toBe("")
    expect(sanitized.sourceId).toBe("")
    expect(sanitized.sourceName).toBe("")
    expect(sanitized.sourceCategory).toBe("industry-news")
    expect(sanitized.excerpt).toHaveLength(500)
    expect(sanitized.relevanceScore).toBe(5)
  })
})
