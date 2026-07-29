import { sha256 } from "@/lib/hash"
import type { Source, Article, IngestStats, IngestProgressEvent, IngestStage } from "@/lib/types"

export interface ExtractedUrlItem {
  url: string
  title: string
  pubDate?: Date | null
}

export interface ExtractedContent {
  title: string
  bodyMd: string
  excerpt: string
  fallbackSource?: string
}

export interface ExtractorAdapter {
  fetchFeedUrls(feedUrl: string): Promise<ExtractedUrlItem[]>
  scrapeContent(url: string): Promise<ExtractedContent>
}

export interface ScorerAdapter {
  scoreArticle(title: string, bodyMd: string, excerpt: string): Promise<number>
}

export interface ClusterEngineAdapter {
  clusterScoredArticle(article: Article): Promise<{
    clusterId: string
    isNewCluster: boolean
    embedding?: number[]
    clusterSummary?: string
  }>
}

export interface RepositoryAdapter {
  getSources(): Promise<Source[]>
  isUrlHashExisting(urlHash: string): Promise<boolean>
  saveArticle(article: Article): Promise<void>
  purgeExpiredArticles(): Promise<number>
}

export interface IngestionPipelineDependencies {
  extractor: ExtractorAdapter
  scorer: ScorerAdapter
  clusterEngine: ClusterEngineAdapter
  repository: RepositoryAdapter
}

export interface IngestionPipelineRunOptions {
  onProgress?: (event: IngestProgressEvent) => void
}

const RELEVANCE_THRESHOLD = 5
const THREE_DAYS_MS = 72 * 60 * 60 * 1000

export class IngestionPipeline {
  private extractor: ExtractorAdapter
  private scorer: ScorerAdapter
  private clusterEngine: ClusterEngineAdapter
  private repository: RepositoryAdapter

  constructor(deps: IngestionPipelineDependencies) {
    this.extractor = deps.extractor
    this.scorer = deps.scorer
    this.clusterEngine = deps.clusterEngine
    this.repository = deps.repository
  }

  async ingest(
    sourcesParam?: Source[],
    options: IngestionPipelineRunOptions = {}
  ): Promise<IngestStats> {
    return this.runInternal(sourcesParam, options)
  }

  async run(options: IngestionPipelineRunOptions = {}): Promise<IngestStats> {
    return this.runInternal(undefined, options)
  }

  private async runInternal(
    sourcesParam?: Source[],
    options: IngestionPipelineRunOptions = {}
  ): Promise<IngestStats> {
    const startTime = Date.now()
    const onProgress = options.onProgress ?? (() => {})

    const stats: IngestStats = {
      duration_ms: 0,
      sources: 0,
      urls_found: 0,
      too_old: 0,
      new_articles: 0,
      discarded: 0,
      clustered: 0,
      clusters_created: 0,
    }

    const emit = (stage: IngestStage, stepNumber: number, message: string) => {
      onProgress({
        stage,
        stepNumber,
        totalSteps: 9,
        message,
        stats: { ...stats },
      })
    }

    // Step 1: Load sources
    emit("load_sources", 1, "Step 1/9 — Loading sources")
    let enabledSources: Source[] = []
    if (sourcesParam && sourcesParam.length > 0) {
      enabledSources = sourcesParam.filter((s) => s.enabled)
    } else {
      const allSources = await this.repository.getSources()
      enabledSources = allSources.filter((s) => s.enabled)
    }
    stats.sources = enabledSources.length

    if (enabledSources.length === 0) {
      emit("load_sources", 1, "No enabled sources found. Stopping.")
      stats.duration_ms = Date.now() - startTime
      return stats
    }

    emit(
      "load_sources",
      1,
      `Found ${enabledSources.length} enabled source${enabledSources.length === 1 ? "" : "s"}`
    )

    // Step 2: Fetch feed URLs
    emit("fetch_feed", 2, "Step 2/9 — Resolving article URLs")
    const rawItems: Array<{ url: string; title: string; source: Source; pubDate?: Date | null }> =
      []

    for (const source of enabledSources) {
      const targetUrl = source.feedUrl || source.url
      try {
        const items = await this.extractor.fetchFeedUrls(targetUrl)
        let tooOldCount = 0
        let keptCount = 0
        const cutoffTime = new Date(Date.now() - THREE_DAYS_MS)

        for (const item of items) {
          if (item.pubDate && item.pubDate < cutoffTime) {
            tooOldCount++
            stats.too_old++
          } else {
            keptCount++
            rawItems.push({
              url: item.url,
              title: item.title,
              source,
              pubDate: item.pubDate,
            })
          }
        }

        emit(
          "fetch_feed",
          2,
          `  [${source.name}]: ${items.length} items (${tooOldCount} too old, ${keptCount} kept)`
        )
      } catch (err) {
        emit("fetch_feed", 2, `  Error resolving ${source.name}: ${(err as Error).message}`)
      }
    }
    stats.urls_found = rawItems.length
    emit(
      "fetch_feed",
      2,
      `Resolved ${stats.urls_found} unique URLs (${stats.too_old} filtered as too old)`
    )

    // Step 3: Deduplicate against existing repository records
    emit("deduplicate", 3, "Step 3/9 — Deduplicating against existing articles")
    const newCandidates: typeof rawItems = []
    const seenUrls = new Set<string>()

    for (const item of rawItems) {
      if (seenUrls.has(item.url)) continue
      seenUrls.add(item.url)

      const urlHash = sha256(item.url)
      const exists = await this.repository.isUrlHashExisting(urlHash)
      if (!exists) {
        newCandidates.push(item)
      }
    }

    emit(
      "deduplicate",
      3,
      `  ${newCandidates.length} new URLs to scrape (${stats.urls_found - newCandidates.length} already ingested)`
    )

    // Step 4: Scrape content
    emit("scrape_content", 4, "Step 4/9 — Scraping articles")
    const scrapedArticles: Array<{
      candidate: (typeof newCandidates)[0]
      content: ExtractedContent
    }> = []

    for (const candidate of newCandidates) {
      let domain = candidate.source.name
      try {
        domain = new URL(candidate.url).hostname
      } catch {
        // Fallback to source name
      }

      emit("scrape_content", 4, `  Scraping [${domain}]: ${candidate.url}`)
      let content: ExtractedContent
      try {
        content = await this.extractor.scrapeContent(candidate.url)
        if (content.fallbackSource) {
          emit("scrape_content", 4, `  Saved via ${content.fallbackSource}: ${candidate.url}`)
        } else {
          emit("scrape_content", 4, `  Saved: "${content.title || candidate.title}"`)
        }
        scrapedArticles.push({ candidate, content })
      } catch (_err) {
        emit("scrape_content", 4, `  No content extracted [${domain}] — marking as fetch_failed`)
        const urlHash = sha256(candidate.url)
        const failedArticle: Article = {
          id: urlHash,
          url: candidate.url,
          urlHash,
          title: candidate.title,
          domain,
          sourceId: candidate.source.id,
          sourceName: candidate.source.name,
          sourceCategory: candidate.source.category,
          bodyMd: "",
          excerpt: "",
          relevanceScore: 0,
          embedding: [],
          status: "fetch_failed",
          ingestedAt: new Date(),
        }
        await this.repository.saveArticle(failedArticle)
      }
    }

    stats.new_articles = scrapedArticles.length
    emit(
      "scrape_content",
      4,
      `Scraped ${stats.new_articles} article${stats.new_articles === 1 ? "" : "s"}`
    )

    // Step 5: Score relevance
    emit("score_relevance", 5, "Step 5/9 — Scoring relevance")
    const relevantArticles: Array<{
      candidate: (typeof newCandidates)[0]
      content: ExtractedContent
      score: number
    }> = []

    for (const { candidate, content } of scrapedArticles) {
      let score = 5
      try {
        score = await this.scorer.scoreArticle(content.title, content.bodyMd, content.excerpt)
      } catch {
        score = 5
      }

      if (score < RELEVANCE_THRESHOLD) {
        stats.discarded++
        emit(
          "score_relevance",
          5,
          `  Discarded (score ${score}/10): "${content.title || candidate.title}"`
        )
      } else {
        relevantArticles.push({
          candidate,
          content: { ...content, title: content.title || candidate.title },
          score,
        })
        emit(
          "score_relevance",
          5,
          `  Relevant (score ${score}/10): "${content.title || candidate.title}"`
        )
      }
    }

    stats.new_articles = relevantArticles.length
    emit(
      "score_relevance",
      5,
      `Scoring done: ${relevantArticles.length} relevant, ${stats.discarded} discarded`
    )

    // Step 6: Generate embeddings & Step 7: Cluster & Step 8: Persist
    emit("cluster_articles", 6, "Step 6/9 — Generating embeddings")
    emit("cluster_articles", 7, "Step 7/9 — Clustering")
    emit("cluster_articles", 8, "Step 8/9 — Persisting results")

    for (const { candidate, content, score } of relevantArticles) {
      const urlHash = sha256(candidate.url)
      let domain = candidate.source.name
      try {
        domain = new URL(candidate.url).hostname
      } catch {
        // Fallback to source name
      }

      const article: Article = {
        id: urlHash,
        url: candidate.url,
        urlHash,
        title: content.title,
        domain,
        sourceId: candidate.source.id,
        sourceName: candidate.source.name,
        sourceCategory: candidate.source.category,
        bodyMd: content.bodyMd,
        excerpt: content.excerpt,
        relevanceScore: score,
        embedding: [],
        status: "scored",
        ingestedAt: new Date(),
      }

      emit("cluster_articles", 6, `  Embedded: "${article.title}"`)

      try {
        const clusterRes = await this.clusterEngine.clusterScoredArticle(article)
        article.status = "clustered"
        if (clusterRes.embedding) {
          article.embedding = clusterRes.embedding
        }
        stats.clustered++
        if (clusterRes.isNewCluster) {
          stats.clusters_created++
          emit("cluster_articles", 7, `  Created new cluster: "${article.title}"`)
        } else {
          emit(
            "cluster_articles",
            7,
            `  Matched existing cluster: "${article.title}" -> "${clusterRes.clusterSummary || article.title}"`
          )
        }
      } catch {
        // Keep status scored if clustering fails
      }

      await this.repository.saveArticle(article)
    }

    // Step 9: Purge TTL expired articles
    emit("purge_ttl", 9, "Step 9/9 — Purging expired articles")
    const purgedCount = await this.repository.purgeExpiredArticles()
    if (purgedCount > 0) {
      emit("purge_ttl", 9, `Purged ${purgedCount} expired article${purgedCount === 1 ? "" : "s"}`)
    }

    stats.duration_ms = Date.now() - startTime
    const durationSec = (stats.duration_ms / 1000).toFixed(1)
    emit(
      "complete",
      9,
      `Ingest pipeline complete in ${durationSec}s. Clustered ${stats.clustered} new articles into ${stats.clusters_created} new clusters.`
    )

    return stats
  }
}

export function createProductionIngestionPipeline(): IngestionPipeline {
  return new IngestionPipeline({
    extractor: {
      async fetchFeedUrls(feedUrl: string) {
        const { parseRssFeed } = await import("@/lib/rss")
        const items = await parseRssFeed(feedUrl)
        return items.map((i) => ({
          url: i.url,
          title: i.url,
          pubDate: i.pubDate,
        }))
      },
      async scrapeContent(url: string) {
        const { fetchArticle } = await import("@/lib/scrape")
        const art = await fetchArticle(url)
        return {
          title: art.title,
          bodyMd: art.markdown,
          excerpt: art.excerpt || art.markdown.slice(0, 200),
        }
      },
    },
    scorer: {
      async scoreArticle(title: string, bodyMd: string, excerpt: string) {
        const { GoogleGenAI } = await import("@google/genai")
        const ai = new GoogleGenAI({
          enterprise: true,
          project: process.env.GOOGLE_CLOUD_PROJECT_ID,
          location: process.env.GOOGLE_CLOUD_LOCATION ?? "global",
        })
        const model = process.env.INGEST_MODEL ?? "gemini-3.5-flash-lite"
        const prompt = `Rate the AI relevance of this article from 1 to 10. Title: ${title}. Excerpt: ${excerpt}. Return ONLY a single integer number.`
        const res = await ai.models.generateContent({ model, contents: prompt })
        const text = res.text?.trim() ?? "5"
        const score = parseInt(text, 10)
        return isNaN(score) ? 5 : Math.max(1, Math.min(10, score))
      },
    },
    clusterEngine: {
      async clusterScoredArticle(article: Article) {
        const { embed, clusterWithExisting, toClusterArticle } = await import("@/lib/cluster")
        const { getRecentClusterCentroids, updateCluster, db } = await import("@/lib/firebase")

        const embedding = await embed(`${article.title}\n${article.excerpt}`)
        const articleWithEmb = {
          ...toClusterArticle({ ...article, embedding, relevanceScore: article.relevanceScore }),
          embedding,
          bodyMd: article.bodyMd,
        }
        const existingCentroids = await getRecentClusterCentroids()
        const existingForCluster = existingCentroids.map((c) => ({
          id: c.id,
          centroid: c.centroid,
          articles: c.articles.map((a) => ({ ...a, embedding: c.centroid })),
        }))

        const result = clusterWithExisting([articleWithEmb], existingForCluster)
        let clusterId = ""
        let isNewCluster = false
        let clusterSummary = article.title

        if (result.newClusters.length > 0) {
          isNewCluster = true
          const newC = result.newClusters[0]
          const ref = db.collection("clusters").doc()
          clusterId = ref.id
          clusterSummary = article.title
          await ref.set({
            summary: article.title,
            topicTag: "other",
            sentiment: "neutral",
            entities: [],
            isSingleton: newC.isSingleton,
            articles: newC.articles.map((a) => ({
              id: a.id,
              title: a.title,
              url: a.url,
              domain: a.domain,
              sourceId: a.sourceId,
              sourceName: a.sourceName,
              sourceCategory: a.sourceCategory,
              excerpt: a.excerpt,
              relevanceScore: a.relevanceScore,
            })),
            articleCount: newC.articles.length,
            centroid: newC.centroid,
            createdAt: new Date(),
            publishedAt: new Date(),
          })
        } else if (result.updatedClusters.length > 0) {
          const upC = result.updatedClusters[0]
          clusterId = upC.id
          clusterSummary = article.title
          await updateCluster(upC.id, upC.articles, upC.centroid)
        }

        return { clusterId, isNewCluster, embedding, clusterSummary }
      },
    },
    repository: {
      async getSources() {
        const { db, docToSource } = await import("@/lib/firebase")
        const snap = await db.collection("sources").where("enabled", "==", true).get()
        return snap.docs.map((d) => docToSource(d.id, d.data()))
      },
      async isUrlHashExisting(urlHash: string) {
        const { db } = await import("@/lib/firebase")
        const doc = await db.collection("articles").doc(urlHash).get()
        return doc.exists
      },
      async saveArticle(article: Article) {
        const { db } = await import("@/lib/firebase")
        await db
          .collection("articles")
          .doc(article.id)
          .set({
            ...article,
            ingestedAt: new Date(),
          })
      },
      async purgeExpiredArticles() {
        const { db } = await import("@/lib/firebase")
        const now = new Date()
        const snap = await db.collection("articles").where("expireAt", "<=", now).get()
        const batch = db.batch()
        snap.docs.forEach((doc) => batch.delete(doc.ref))
        await batch.commit()
        return snap.size
      },
    },
  })
}
