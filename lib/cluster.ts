import { GoogleGenAI } from "@google/genai"
import type { ClusterArticle } from "@/lib/types"

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? "global"

const ai = new GoogleGenAI({
  enterprise: true,
  project: PROJECT_ID,
  location: LOCATION,
})

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "gemini-embedding-2"
const CLUSTER_THRESHOLD = 0.82

export interface ArticleWithEmbedding {
  id: string
  title: string
  url: string
  domain: string
  excerpt: string
  relevanceScore: number
  embedding: number[]
  pubDate?: Date | null
}

export interface ArticleCluster {
  articles: ArticleWithEmbedding[]
  centroid: number[]
  isSingleton: boolean
}

export interface ExistingCluster {
  id: string
  centroid: number[]
  articles: ArticleWithEmbedding[]
}

export interface ClusteringResult {
  newClusters: ArticleCluster[]
  updatedClusters: Array<{ id: string; articles: ArticleWithEmbedding[]; centroid: number[] }>
}

export async function embed(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      taskType: "SEMANTIC_SIMILARITY",
      outputDimensionality: 768,
    },
  })
  const values = response.embeddings?.[0]?.values
  if (!values || values.length === 0) {
    throw new Error("Empty embedding returned")
  }
  return values
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

function meanVector(vectors: number[][]): number[] {
  if (vectors.length === 0) return []
  const len = vectors[0].length
  const sum = new Array<number>(len).fill(0)
  for (const v of vectors) {
    for (let i = 0; i < len; i++) {
      sum[i] += v[i]
    }
  }
  return sum.map((v) => v / vectors.length)
}

function findBestMatch<T extends { centroid: number[] }>(
  embedding: number[],
  candidates: T[]
): { index: number; similarity: number } {
  let index = -1
  let similarity = -1
  for (let i = 0; i < candidates.length; i++) {
    const sim = cosineSimilarity(embedding, candidates[i].centroid)
    if (sim > similarity) {
      similarity = sim
      index = i
    }
  }
  return { index, similarity }
}

export function clusterWithExisting(
  newArticles: ArticleWithEmbedding[],
  existing: ExistingCluster[]
): ClusteringResult {
  // mutable copies so we can recompute centroids as articles are added
  const existingMutable = existing.map((c) => ({ ...c, articles: [...c.articles] }))
  const unmatched: ArticleWithEmbedding[] = []

  for (const article of newArticles) {
    const { index, similarity } = findBestMatch(article.embedding, existingMutable)

    if (index >= 0 && similarity >= CLUSTER_THRESHOLD) {
      existingMutable[index].articles.push(article)
      existingMutable[index].centroid = meanVector(
        existingMutable[index].articles.map((a) => a.embedding)
      )
    } else {
      unmatched.push(article)
    }
  }

  const touched = existingMutable.filter((c, i) => c.articles.length > existing[i].articles.length)

  return {
    newClusters: clusterArticles(unmatched),
    updatedClusters: touched.map((c) => ({
      id: c.id,
      articles: c.articles,
      centroid: c.centroid,
    })),
  }
}

export function clusterArticles(articles: ArticleWithEmbedding[]): ArticleCluster[] {
  const clusters: ArticleCluster[] = []

  for (const article of articles) {
    const { index, similarity } = findBestMatch(article.embedding, clusters)

    if (index >= 0 && similarity >= CLUSTER_THRESHOLD) {
      clusters[index].articles.push(article)
      clusters[index].centroid = meanVector(clusters[index].articles.map((a) => a.embedding))
      clusters[index].isSingleton = false
    } else {
      clusters.push({ articles: [article], centroid: article.embedding, isSingleton: true })
    }
  }

  return clusters
}

export function toClusterArticle(a: ArticleWithEmbedding): ClusterArticle {
  return {
    id: a.id,
    title: a.title,
    url: a.url,
    domain: a.domain,
    excerpt: a.excerpt,
    relevanceScore: a.relevanceScore,
  }
}
