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
}

export interface ExtractorAdapter {
  fetchFeedUrls(feedUrl: string): Promise<ExtractedUrlItem[]>
  scrapeContent(url: string): Promise<ExtractedContent>
}

export interface ScorerAdapter {
  scoreArticle(title: string, bodyMd: string, excerpt: string): Promise<number>
}

export interface ClusterEngineAdapter {
  clusterScoredArticle(
    article: Article
  ): Promise<{ clusterId: string; isNewCluster: boolean; embedding?: number[] }>
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
    emit("load_sources", 1, "Loading news sources")
    let enabledSources: Source[] = []
    if (sourcesParam && sourcesParam.length > 0) {
      enabledSources = sourcesParam.filter((s) => s.enabled)
    } else {
      const allSources = await this.repository.getSources()
      enabledSources = allSources.filter((s) => s.enabled)
    }
    stats.sources = enabledSources.length

    // Step 2: Fetch feed URLs
    emit("fetch_feed", 2, `Fetching URLs from ${enabledSources.length} sources`)
    const rawItems: Array<{ url: string; title: string; source: Source; pubDate?: Date | null }> =
      []

    for (const source of enabledSources) {
      const targetUrl = source.feedUrl || source.url
      try {
        const items = await this.extractor.fetchFeedUrls(targetUrl)
        for (const item of items) {
          rawItems.push({
            url: item.url,
            title: item.title,
            source,
            pubDate: item.pubDate,
          })
        }
      } catch {
        // Continue loop if feed fetch fails
      }
    }
    stats.urls_found = rawItems.length

    // Step 3: Age cutoff check (3-day window)
    emit("fetch_feed", 3, "Checking article age limits")
    const cutoff = new Date(Date.now() - THREE_DAYS_MS)
    const validAgeItems: typeof rawItems = []

    for (const item of rawItems) {
      if (item.pubDate && item.pubDate < cutoff) {
        stats.too_old++
      } else {
        validAgeItems.push(item)
      }
    }

    // Step 4: Deduplicate against existing repository records
    emit("deduplicate", 4, "Checking for existing article hashes")
    const newCandidates: typeof validAgeItems = []
    for (const item of validAgeItems) {
      const urlHash = sha256(item.url)
      const exists = await this.repository.isUrlHashExisting(urlHash)
      if (!exists) {
        newCandidates.push(item)
      }
    }

    // Step 5 & 6 & 7 & 8: Scrape, score, cluster, persist
    for (const candidate of newCandidates) {
      const urlHash = sha256(candidate.url)

      // Step 5: Scrape content
      emit("scrape_content", 5, `Scraping content for: ${candidate.title}`)
      let content: ExtractedContent
      try {
        content = await this.extractor.scrapeContent(candidate.url)
      } catch {
        const failedArticle: Article = {
          id: urlHash,
          url: candidate.url,
          urlHash,
          title: candidate.title,
          domain: candidate.source.name,
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
        continue
      }

      // Step 6: Score relevance
      emit("score_relevance", 6, `Scoring relevance for: ${candidate.title}`)
      let score = 5
      try {
        score = await this.scorer.scoreArticle(content.title, content.bodyMd, content.excerpt)
      } catch {
        score = 5
      }

      if (score < RELEVANCE_THRESHOLD) {
        stats.discarded++
        continue
      }

      stats.new_articles++

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
        title: content.title || candidate.title,
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

      // Step 7: Embed & Cluster
      emit("cluster_articles", 7, `Clustering article: ${article.title}`)
      try {
        const clusterRes = await this.clusterEngine.clusterScoredArticle(article)
        article.status = "clustered"
        if (clusterRes.embedding) {
          article.embedding = clusterRes.embedding
        }
        stats.clustered++
        if (clusterRes.isNewCluster) {
          stats.clusters_created++
        }
      } catch {
        // Keep status scored if clustering fails
      }

      // Step 8: Persist article
      await this.repository.saveArticle(article)
    }

    // Step 9: Purge TTL expired articles
    emit("purge_ttl", 9, "Purging expired articles")
    await this.repository.purgeExpiredArticles()

    stats.duration_ms = Date.now() - startTime
    emit("complete", 9, `Pipeline complete. Clustered ${stats.clustered} new articles.`)

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

        if (result.newClusters.length > 0) {
          isNewCluster = true
          const newC = result.newClusters[0]
          const ref = db.collection("clusters").doc()
          clusterId = ref.id
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
          await updateCluster(upC.id, upC.articles, upC.centroid)
        }

        return { clusterId, isNewCluster, embedding }
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
