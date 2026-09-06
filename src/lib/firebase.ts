import { Firestore, FieldValue, type QueryDocumentSnapshot } from "@google-cloud/firestore"
import type {
  Cluster,
  ClusterArticle,
  Digest,
  DigestScope,
  Source,
  SourceCategory,
} from "@/lib/types"

// Initialize Google Cloud Firestore
// For production, you should use service account credentials
// For development, you can use Application Default Credentials (ADC)
const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  // If you have a service account key file, uncomment and use:
  // keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  databaseId: process.env.FIRESTORE_DATABASE_ID,
  ignoreUndefinedProperties: true,
  // Add connection pooling settings
  maxIdleTime: 0, // no idle timeout — keep connections open
  maxConcurrency: 100, // Max concurrent requests
  keepAlive: true,
})

export { db }

/**
 * Helper to calculate the expiration timestamp based on TTL_DAYS env var.
 * Minimum of 3 days to avoid deleting clusters needed for ongoing centroid matching.
 */
export function getTtlExpirationDate(): Date {
  const defaultTtlDays = 14
  const envTtl = process.env.TTL_DAYS ? parseInt(process.env.TTL_DAYS, 10) : defaultTtlDays
  const ttlDays = isNaN(envTtl) || envTtl < 3 ? defaultTtlDays : envTtl
  return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
}

export function docToSource(id: string, data: FirebaseFirestore.DocumentData): Source {
  return {
    id,
    url: data.url,
    type: data.type,
    feedUrl: data.feedUrl,
    name: data.name,
    enabled: data.enabled,
    category: (data.category as SourceCategory) ?? "industry-news",
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
  }
}

function mapDocToCluster(doc: QueryDocumentSnapshot): Cluster {
  const d = doc.data()
  const createdAt = d.createdAt?.toDate?.() ?? new Date()
  const publishedAt = d.publishedAt?.toDate?.() ?? createdAt
  return {
    id: doc.id,
    summary: d.summary,
    topicTag: d.topicTag,
    categories: d.categories ?? (d.primaryCategory ? [d.primaryCategory] : []),
    primaryCategory: d.primaryCategory ?? undefined,
    sentiment: d.sentiment,
    entities: d.entities ?? [],
    isSingleton: d.isSingleton ?? false,
    articles: d.articles ?? [],
    articleCount: d.articleCount ?? 0,
    createdAt,
    publishedAt,
    expireAt: d.expireAt?.toDate?.() ?? undefined,
    importanceScore: d.importanceScore ?? undefined,
    keyTakeaways: d.keyTakeaways ?? [],
    whyItMatters: d.whyItMatters ?? "",
  } satisfies Cluster
}

export async function getClustersByDateRange(startDate: Date, endDate: Date): Promise<Cluster[]> {
  try {
    const snap = await db
      .collection("clusters")
      .where("publishedAt", ">=", startDate)
      .where("publishedAt", "<=", endDate)
      .orderBy("publishedAt", "desc")
      .get()
    const now = new Date()
    return snap.docs.map(mapDocToCluster).filter((c) => !c.expireAt || c.expireAt > now)
  } catch (error) {
    console.error("Error fetching clusters by date range:", error)
    return []
  }
}

export async function getClusterById(id: string): Promise<Cluster | null> {
  try {
    const doc = await db.collection("clusters").doc(id).get()
    if (!doc.exists) return null
    return mapDocToCluster(doc as QueryDocumentSnapshot)
  } catch (error) {
    console.error("Error fetching cluster by id:", error)
    return null
  }
}

export async function getClusters(limitCount = 100): Promise<Cluster[]> {
  try {
    const snap = await db
      .collection("clusters")
      .orderBy("createdAt", "desc")
      .limit(limitCount)
      .get()
    const now = new Date()
    return snap.docs.map(mapDocToCluster).filter((c) => !c.expireAt || c.expireAt > now)
  } catch (error) {
    console.error("Error fetching clusters:", error)
    return []
  }
}

export interface StoredClusterCentroid {
  id: string
  centroid: number[]
  articles: ClusterArticle[]
}

export async function getRecentClusterCentroids(days = 3): Promise<StoredClusterCentroid[]> {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const snap = await db.collection("clusters").where("createdAt", ">=", cutoff).get()
    return snap.docs
      .filter((d) => Array.isArray(d.data().centroid) && d.data().centroid.length > 0)
      .map((d) => ({
        id: d.id,
        centroid: d.data().centroid as number[],
        articles: (d.data().articles ?? []) as ClusterArticle[],
      }))
  } catch (error) {
    console.error("Error fetching cluster centroids:", error)
    return []
  }
}

export async function saveDigest(
  digest: Omit<Digest, "generatedAt"> & { generatedAt: Date },
  scope: DigestScope = "daily",
  category?: SourceCategory | "all"
): Promise<void> {
  const cat = category && category !== "all" ? category : null
  const docId = cat ? `${scope}_${cat}` : scope === "daily" ? "latest" : scope

  const payload = {
    headline: digest.headline,
    insights: digest.insights,
    generatedAt: digest.generatedAt,
    scope,
    category: category ?? "all",
  }

  await db.collection("digest").doc(docId).set(payload)

  if (scope === "daily" && !cat) {
    await db.collection("digest").doc("daily").set(payload)
  }
}

export async function getLatestDigest(
  scope: DigestScope = "daily",
  category?: SourceCategory | "all"
): Promise<Digest | null> {
  try {
    const cat = category && category !== "all" ? category : null
    const docId = cat ? `${scope}_${cat}` : scope === "daily" ? "latest" : scope

    let doc = await db.collection("digest").doc(docId).get()
    if (!doc.exists && scope === "daily" && !cat) {
      doc = await db.collection("digest").doc("latest").get()
    }

    if (!doc.exists) {
      return null
    }

    const d = doc.data()!
    return {
      headline: d.headline ?? "",
      insights: d.insights ?? [],
      generatedAt: d.generatedAt?.toDate?.() ?? new Date(),
      scope: (d.scope as DigestScope) ?? scope,
      category: (d.category as SourceCategory | "all") ?? category ?? "all",
    }
  } catch (error) {
    console.error(`Error fetching digest (${scope}, ${category}):`, error)
    return null
  }
}

export async function getDigestManifest(): Promise<
  Array<{
    docId: string
    scope: DigestScope
    category: SourceCategory | "all"
    generatedAt: string
  }>
> {
  try {
    const snapshot = await db.collection("digest").get()
    return snapshot.docs.map((doc) => {
      const d = doc.data()
      let scope: DigestScope = d.scope as DigestScope
      let category: SourceCategory | "all" = d.category as SourceCategory | "all"

      if (!scope) {
        if (doc.id === "latest" || doc.id === "daily" || doc.id.startsWith("daily_"))
          scope = "daily"
        else if (doc.id === "weekly" || doc.id.startsWith("weekly_")) scope = "weekly"
        else if (doc.id === "monthly" || doc.id.startsWith("monthly_")) scope = "monthly"
        else if (doc.id === "overview" || doc.id.startsWith("overview_")) scope = "overview"
        else scope = "daily"
      }

      if (!category) {
        if (doc.id.includes("_")) {
          category = doc.id.split("_").slice(1).join("_") as SourceCategory
        } else {
          category = "all"
        }
      }

      const generatedAtDate: Date = d.generatedAt?.toDate?.() ?? new Date()

      return {
        docId: doc.id,
        scope,
        category,
        generatedAt: generatedAtDate.toISOString(),
      }
    })
  } catch (error) {
    console.error("Error fetching digest manifest:", error)
    return []
  }
}

export async function updateCluster(
  id: string,
  articles: ClusterArticle[],
  centroid: number[],
  extraFields?: Record<string, unknown>
): Promise<void> {
  const sanitizedArticles: ClusterArticle[] = articles.map((a) => ({
    id: a.id,
    title: a.title ?? "",
    url: a.url ?? "",
    domain: a.domain ?? "",
    sourceId: a.sourceId ?? "",
    sourceName: a.sourceName ?? "",
    sourceCategory: a.sourceCategory ?? "industry-news",
    excerpt: (a.excerpt ?? "").slice(0, 500),
    relevanceScore: typeof a.relevanceScore === "number" ? a.relevanceScore : 5,
  }))

  await db
    .collection("clusters")
    .doc(id)
    .update({
      articles: sanitizedArticles,
      centroid,
      articleCount: sanitizedArticles.length,
      isSingleton: sanitizedArticles.length === 1,
      expireAt: getTtlExpirationDate(),
      updatedAt: FieldValue.serverTimestamp(),
      ...(extraFields ?? {}),
    })
}
