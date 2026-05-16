import { describe, it, expect, vi } from "vitest"

// cluster.ts instantiates GoogleGenAI at module level — mock it to avoid credential errors in tests
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {}
  },
}))

import { cosineSimilarity, clusterArticles } from "../cluster"
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
