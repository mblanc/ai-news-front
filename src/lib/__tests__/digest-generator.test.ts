import { describe, it, expect, vi } from "vitest"
import { DigestGenerator } from "../digest-generator"
import type { Cluster, Digest } from "../types"

describe("DigestGenerator", () => {
  it("synthesizes and persists a digest for daily scope", async () => {
    const mockClusters: Cluster[] = [
      {
        id: "cluster-1",
        summary: "New breakthrough in frontier model reasoning.",
        topicTag: "research",
        sentiment: "positive",
        entities: ["OpenAI", "Gemini"],
        isSingleton: false,
        articleCount: 4,
        articles: [
          {
            id: "art-1",
            title: "Reasoning Model Benchmark",
            url: "https://example.com/art-1",
            domain: "example.com",
            sourceId: "src-1",
            sourceName: "AI Daily",
            excerpt: "New benchmarks show 95% accuracy.",
            relevanceScore: 9,
          },
        ],
        createdAt: new Date(),
        publishedAt: new Date(),
        importanceScore: 8.5,
      },
    ]

    const mockClusterRepo = {
      getClustersForScope: vi.fn().mockResolvedValue(mockClusters),
    }

    const mockSynthesizer = {
      synthesizeDigest: vi.fn().mockResolvedValue({
        headline: "Frontier Models Reach New Reasoning Benchmarks",
        insights: [
          {
            text: "Frontier models achieved 95% accuracy on complex math and code evaluations.",
            sources: [
              {
                title: "Reasoning Model Benchmark",
                url: "https://example.com/art-1",
                domain: "example.com",
              },
            ],
          },
        ],
        generatedAt: new Date(),
        scope: "daily",
      } satisfies Digest),
    }

    const mockDigestRepo = {
      saveDigest: vi.fn().mockResolvedValue(undefined),
    }

    const generator = new DigestGenerator({
      clusterRepository: mockClusterRepo,
      synthesizer: mockSynthesizer,
      digestRepository: mockDigestRepo,
    })

    const digest = await generator.generateDigest("daily")

    expect(digest.headline).toBe("Frontier Models Reach New Reasoning Benchmarks")
    expect(mockClusterRepo.getClustersForScope).toHaveBeenCalledWith("daily", undefined)
    expect(mockSynthesizer.synthesizeDigest).toHaveBeenCalledWith("daily", mockClusters, undefined)
    expect(mockDigestRepo.saveDigest).toHaveBeenCalledWith(digest)
  })

  it("calculates cluster impact score using exact formula (articleScore*0.4 + importance*0.6)", () => {
    const cluster: Cluster = {
      id: "c-1",
      summary: "Sample cluster",
      topicTag: "product",
      sentiment: "neutral",
      entities: [],
      isSingleton: false,
      articleCount: 5, // articleScore = min(5*2, 10) = 10 -> 10 * 0.4 = 4.0
      articles: [],
      createdAt: new Date(),
      publishedAt: new Date(),
      importanceScore: 7, // 7 * 0.6 = 4.2
    }

    const generator = new DigestGenerator({
      clusterRepository: { getClustersForScope: vi.fn() },
      synthesizer: { synthesizeDigest: vi.fn() },
      digestRepository: { saveDigest: vi.fn() },
    })

    const score = generator.computeClusterImpactScore(cluster)
    // 4.0 + 4.2 = 8.2
    expect(score).toBeCloseTo(8.2, 2)
  })

  it("filters clusters by category correctly", () => {
    const generator = new DigestGenerator({
      clusterRepository: { getClustersForScope: vi.fn() },
      synthesizer: { synthesizeDigest: vi.fn() },
      digestRepository: { saveDigest: vi.fn() },
    })

    const clusters: Cluster[] = [
      {
        id: "c-frontier",
        summary: "Frontier research paper",
        topicTag: "research",
        primaryCategory: "frontier-research",
        sentiment: "positive",
        entities: [],
        isSingleton: false,
        articleCount: 2,
        articles: [],
        createdAt: new Date(),
        publishedAt: new Date(),
      },
      {
        id: "c-engineering",
        summary: "Next.js AI pipeline setup",
        topicTag: "product",
        primaryCategory: "ai-engineering",
        sentiment: "neutral",
        entities: [],
        isSingleton: true,
        articleCount: 1,
        articles: [],
        createdAt: new Date(),
        publishedAt: new Date(),
      },
    ]

    const filtered = generator.filterClustersByCategory(clusters, "frontier-research")
    expect(filtered.length).toBe(1)
    expect(filtered[0].id).toBe("c-frontier")
  })
})
