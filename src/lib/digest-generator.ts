import type { Cluster, Digest, DigestScope, SourceCategory } from "@/lib/types"

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
          const start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
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
        return getClusters()
      },
    },
    synthesizer: {
      async synthesizeDigest(scope: DigestScope, clusters: Cluster[], category?: SourceCategory) {
        const { GoogleGenAI } = await import("@google/genai")
        const ai = new GoogleGenAI({
          enterprise: true,
          project: process.env.GOOGLE_CLOUD_PROJECT_ID,
          location: process.env.GOOGLE_CLOUD_LOCATION ?? "global",
        })
        const model = process.env.INGEST_MODEL ?? "gemini-3.5-flash-lite"
        const clusterTexts = clusters
          .slice(0, 10)
          .map((c) => `- ${c.summary}`)
          .join("\n")
        const prompt = `Synthesize an executive summary digest for scope: ${scope}. Clusters:\n${clusterTexts}`
        const res = await ai.models.generateContent({ model, contents: prompt })
        const headline = res.text?.split("\n")[0] || `${scope.toUpperCase()} AI News Digest`

        return {
          headline,
          insights: clusters.slice(0, 5).map((c) => ({
            text: c.summary,
            category: c.primaryCategory,
            sources: c.articles.map((a) => ({
              title: a.title,
              url: a.url,
              domain: a.domain,
              sourceName: a.sourceName,
            })),
          })),
          generatedAt: new Date(),
          scope,
          category: category ?? "all",
        }
      },
    },
    digestRepository: {
      async saveDigest(digest: Digest) {
        const { saveDigest } = await import("@/lib/firebase")
        await saveDigest(digest)
      },
    },
  })
}
