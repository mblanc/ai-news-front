import { describe, it, expect, vi } from "vitest"
import { IngestionPipeline } from "../ingestion-pipeline"
import type { Source, IngestProgressEvent } from "../types"

describe("IngestionPipeline", () => {
  it("executes ingestion flow with mock adapters and emits progress events", async () => {
    const mockSources: Source[] = [
      {
        id: "source-1",
        url: "https://example.com/rss",
        type: "rss",
        feedUrl: "https://example.com/rss.xml",
        name: "Example AI News",
        enabled: true,
        category: "ai-engineering",
        createdAt: new Date(),
      },
    ]

    const events: IngestProgressEvent[] = []

    const mockExtractor = {
      fetchFeedUrls: vi
        .fn()
        .mockResolvedValue([
          {
            url: "https://example.com/article-1",
            title: "New LLM Architecture",
            pubDate: new Date(),
          },
        ]),
      scrapeContent: vi.fn().mockResolvedValue({
        title: "New LLM Architecture",
        bodyMd: "# New LLM Architecture\nThis is a deep dive into new transformer architectures.",
        excerpt: "Deep dive into new transformer architectures.",
      }),
    }

    const mockScorer = {
      scoreArticle: vi.fn().mockResolvedValue(8),
    }

    const mockClusterEngine = {
      clusterScoredArticle: vi.fn().mockResolvedValue({
        clusterId: "cluster-1",
        isNewCluster: true,
      }),
    }

    const mockRepository = {
      getSources: vi.fn().mockResolvedValue(mockSources),
      isUrlHashExisting: vi.fn().mockResolvedValue(false),
      saveArticle: vi.fn().mockResolvedValue(undefined),
      purgeExpiredArticles: vi.fn().mockResolvedValue(0),
    }

    const pipeline = new IngestionPipeline({
      extractor: mockExtractor,
      scorer: mockScorer,
      clusterEngine: mockClusterEngine,
      repository: mockRepository,
    })

    const stats = await pipeline.run({
      onProgress: (evt) => events.push(evt),
    })

    expect(stats.sources).toBe(1)
    expect(stats.urls_found).toBe(1)
    expect(stats.new_articles).toBe(1)
    expect(stats.clustered).toBe(1)
    expect(stats.clusters_created).toBe(1)

    expect(mockExtractor.fetchFeedUrls).toHaveBeenCalledWith("https://example.com/rss.xml")
    expect(mockScorer.scoreArticle).toHaveBeenCalled()
    expect(mockClusterEngine.clusterScoredArticle).toHaveBeenCalled()
    expect(mockRepository.saveArticle).toHaveBeenCalled()

    expect(events.length).toBeGreaterThan(0)
    expect(events[events.length - 1].stage).toBe("complete")
  })

  it("filters out articles with relevance score < 5", async () => {
    const mockSources: Source[] = [
      {
        id: "source-2",
        url: "https://example.com/rss",
        type: "rss",
        name: "Low Relevance Feed",
        enabled: true,
        createdAt: new Date(),
      },
    ]

    const mockExtractor = {
      fetchFeedUrls: vi
        .fn()
        .mockResolvedValue([
          { url: "https://example.com/unrelated", title: "Irrelevant Post", pubDate: new Date() },
        ]),
      scrapeContent: vi.fn().mockResolvedValue({
        title: "Irrelevant Post",
        bodyMd: "Unrelated content.",
        excerpt: "Unrelated content.",
      }),
    }

    const mockScorer = {
      scoreArticle: vi.fn().mockResolvedValue(2), // low score
    }

    const mockClusterEngine = {
      clusterScoredArticle: vi.fn(),
    }

    const mockRepository = {
      getSources: vi.fn().mockResolvedValue(mockSources),
      isUrlHashExisting: vi.fn().mockResolvedValue(false),
      saveArticle: vi.fn().mockResolvedValue(undefined),
      purgeExpiredArticles: vi.fn().mockResolvedValue(0),
    }

    const pipeline = new IngestionPipeline({
      extractor: mockExtractor,
      scorer: mockScorer,
      clusterEngine: mockClusterEngine,
      repository: mockRepository,
    })

    const stats = await pipeline.run()

    expect(stats.urls_found).toBe(1)
    expect(stats.discarded).toBe(1)
    expect(stats.new_articles).toBe(0)
    expect(mockClusterEngine.clusterScoredArticle).not.toHaveBeenCalled()
  })
})
