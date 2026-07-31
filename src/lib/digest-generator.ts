import type { Cluster, Digest, DigestScope, GroundedInsight, SourceCategory } from "@/lib/types"
import { cleanArticleTitle } from "@/lib/scrape"

export interface ClusterRepositoryAdapter {
  getClustersForScope(scope: DigestScope, category?: SourceCategory): Promise<Cluster[]>
}

export interface DigestSynthesizerAdapter {
  synthesizeDigest(
    scope: DigestScope,
    clusters: Cluster[],
    category?: SourceCategory
  ): Promise<Digest>
}

export interface DigestRepositoryAdapter {
  saveDigest(digest: Digest): Promise<void>
}

export interface DigestGeneratorDependencies {
  clusterRepository: ClusterRepositoryAdapter
  synthesizer: DigestSynthesizerAdapter
  digestRepository: DigestRepositoryAdapter
}

export class DigestGenerator {
  private clusterRepository: ClusterRepositoryAdapter
  private synthesizer: DigestSynthesizerAdapter
  private digestRepository: DigestRepositoryAdapter

  constructor(deps: DigestGeneratorDependencies) {
    this.clusterRepository = deps.clusterRepository
    this.synthesizer = deps.synthesizer
    this.digestRepository = deps.digestRepository
  }

  computeClusterImpactScore(c: Cluster): number {
    const articleScore = Math.min(c.articleCount * 2, 10)
    const baseImportance = c.importanceScore ?? 5
    const recencyWeight = 1.0
    return articleScore * 0.4 + baseImportance * 0.6 * recencyWeight
  }

  rankClustersByImportance(clusters: Cluster[]): Cluster[] {
    return [...clusters].sort(
      (a, b) => this.computeClusterImpactScore(b) - this.computeClusterImpactScore(a)
    )
  }

  filterClustersByCategory(clusters: Cluster[], category: SourceCategory): Cluster[] {
    return clusters.filter(
      (c) =>
        c.primaryCategory === category ||
        (c.categories && c.categories.includes(category)) ||
        c.articles.some((a) => a.sourceCategory === category)
    )
  }

  async generateDigest(scope: DigestScope, category?: SourceCategory): Promise<Digest> {
    let rawClusters = await this.clusterRepository.getClustersForScope(scope, category)
    if (category) {
      rawClusters = this.filterClustersByCategory(rawClusters, category)
    }
    const rankedClusters = this.rankClustersByImportance(rawClusters)
    const digest = await this.synthesizer.synthesizeDigest(scope, rankedClusters, category)
    await this.digestRepository.saveDigest(digest)
    return digest
  }
}

export function createProductionDigestGenerator(): DigestGenerator {
  return new DigestGenerator({
    clusterRepository: {
      async getClustersForScope(scope: DigestScope) {
        const { getClustersByDateRange, getClusters } = await import("@/lib/firebase")
        const now = new Date()
        if (scope === "daily") {
          const start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
          return getClustersByDateRange(start, now)
        }
        if (scope === "weekly") {
          const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          return getClustersByDateRange(start, now)
        }
        if (scope === "monthly") {
          const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          return getClustersByDateRange(start, now)
        }
        const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        const clusters = await getClustersByDateRange(start, now)
        return clusters.length > 0 ? clusters : getClusters(300)
      },
    },
    synthesizer: {
      async synthesizeDigest(scope: DigestScope, clusters: Cluster[], category?: SourceCategory) {
        const now = new Date()
        const effectiveCategory: SourceCategory | "all" = category ?? "all"

        if (clusters.length === 0) {
          return {
            headline: `${scope.toUpperCase()} AI News Digest`,
            insights: [],
            generatedAt: now,
            scope,
            category: effectiveCategory,
          }
        }

        interface IndexedArticle {
          index: number
          title: string
          url: string
          domain: string
          sourceName?: string
        }

        const indexedArticles: IndexedArticle[] = []
        const articleMap = new Map<number, IndexedArticle>()
        let articleCounter = 1

        const clusterLines = clusters
          .slice(0, 50)
          .map((c) => {
            const articleLines = c.articles
              .map((a) => {
                const idx = articleCounter++
                const cleanTitle = cleanArticleTitle(a.title || a.url)
                const item: IndexedArticle = {
                  index: idx,
                  title: cleanTitle,
                  url: a.url,
                  domain: a.domain,
                  sourceName: a.sourceName,
                }
                indexedArticles.push(item)
                articleMap.set(idx, item)
                return `    - [Article ${idx}] "${cleanTitle}" (Source: ${a.sourceName || a.domain})`
              })
              .join("\n")

            const entities = c.entities?.length ? ` [${c.entities.slice(0, 4).join(", ")}]` : ""
            return `Story: [${c.topicTag}]${entities} ${c.summary}\n  Articles:\n${articleLines}`
          })
          .join("\n\n")

        const timeframeLabel =
          scope === "daily"
            ? "the last 3 days"
            : scope === "weekly"
              ? "the last 7 days"
              : scope === "monthly"
                ? "the last 30 days"
                : "recent months"

        const categoryContext =
          effectiveCategory !== "all"
            ? ` focusing specifically on the "${effectiveCategory}" domain (engineering, research, ecosystem, or industry news)`
            : ""

        const prompt = `You are an executive AI news analyst${categoryContext}. Synthesize a high-level executive summary digest for scope: ${scope} from ${timeframeLabel}.

NEWS STORIES:
${clusterLines}

Return JSON with exactly this structure:
{
  "headline": "A single punchy, non-generic sentence capturing the primary theme or breakthrough of ${timeframeLabel}",
  "insights": [
    {
      "text": "Analytical, specific, 1-2 sentence insight highlighting a trend, tension, or strategic shift",
      "articleIndices": [1, 2]
    }
  ]
}

Rules:
- 3 to 5 analytical insights
- Do NOT use generic markdown headers (like '# Executive Summary Digest') as the headline
- Ground each insight by placing the exact [Article N] integer numbers in "articleIndices"
- Ensure insights are technical and analytical, not simple lists of paper titles`

        let headline = `${scope.toUpperCase()} AI News Digest`
        let insights: GroundedInsight[] = []

        try {
          const { GoogleGenAI } = await import("@google/genai")
          const ai = new GoogleGenAI({
            enterprise: true,
            project: process.env.GOOGLE_CLOUD_PROJECT_ID,
            location: process.env.GOOGLE_CLOUD_LOCATION ?? "global",
          })
          const model = process.env.INGEST_MODEL ?? "gemini-3.5-flash-lite"

          const res = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { responseMimeType: "application/json" },
          })

          const parsed = JSON.parse(res.text ?? "{}")

          if (typeof parsed.headline === "string" && parsed.headline.trim().length > 0) {
            const h = parsed.headline.replace(/^#+\s*/, "").trim()
            if (h && !h.toLowerCase().includes("executive summary digest")) {
              headline = h
            }
          }

          if (Array.isArray(parsed.insights)) {
            insights = parsed.insights
              .map((item: { text?: string; articleIndices?: unknown }) => {
                const text = typeof item === "string" ? item : (item.text ?? "")
                const indices: number[] = Array.isArray(item.articleIndices)
                  ? item.articleIndices
                      .map((i: unknown) => Number(i))
                      .filter((n: number) => !isNaN(n))
                  : []

                const sources = indices
                  .map((idx) => articleMap.get(idx))
                  .filter((a): a is IndexedArticle => !!a)
                  .map((a) => ({
                    title: a.title,
                    url: a.url,
                    domain: a.domain,
                    sourceName: a.sourceName,
                  }))

                return { text, sources }
              })
              .filter((item: GroundedInsight) => item.text.trim().length > 0)
          }
        } catch (err) {
          console.error(`Failed to synthesize digest via Gemini LLM: ${(err as Error).message}`)
        }

        // Fallback insights if LLM synthesis returned empty insights
        if (insights.length === 0) {
          insights = clusters.slice(0, 5).map((c) => ({
            text: c.summary,
            category: c.primaryCategory,
            sources: c.articles.map((a) => ({
              title: cleanArticleTitle(a.title || a.url),
              url: a.url,
              domain: a.domain,
              sourceName: a.sourceName,
            })),
          }))
        }

        return {
          headline,
          insights,
          generatedAt: now,
          scope,
          category: effectiveCategory,
        }
      },
    },
    digestRepository: {
      async saveDigest(digest: Digest) {
        const { saveDigest } = await import("@/lib/firebase")
        await saveDigest(digest, digest.scope, digest.category)
      },
    },
  })
}
