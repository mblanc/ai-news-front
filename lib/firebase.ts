import { Firestore, FieldValue, type QueryDocumentSnapshot } from "@google-cloud/firestore"
import type { Cluster, ClusterArticle, Source } from "@/lib/types"

// Initialize Google Cloud Firestore
// For production, you should use service account credentials
// For development, you can use Application Default Credentials (ADC)
const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  // If you have a service account key file, uncomment and use:
  // keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  databaseId: process.env.FIRESTORE_DATABASE_ID,
  // Add connection pooling settings
  maxIdleTime: 0, // no idle timeout — keep connections open
  maxConcurrency: 100, // Max concurrent requests
  keepAlive: true,
})

export { db }

export function docToSource(id: string, data: FirebaseFirestore.DocumentData): Source {
  return {
    id,
    url: data.url,
    type: data.type,
    feedUrl: data.feedUrl,
    name: data.name,
    enabled: data.enabled,
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
    sentiment: d.sentiment,
    entities: d.entities ?? [],
    isSingleton: d.isSingleton ?? false,
    articles: d.articles ?? [],
    articleCount: d.articleCount ?? 0,
    createdAt,
    publishedAt,
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
    return snap.docs.map(mapDocToCluster)
  } catch (error) {
    console.error("Error fetching clusters by date range:", error)
    return []
  }
}

export async function getClusters(limitCount = 100): Promise<Cluster[]> {
  try {
    const snap = await db
      .collection("clusters")
      .orderBy("createdAt", "desc")
      .limit(limitCount)
      .get()
    return snap.docs.map(mapDocToCluster)
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

export async function updateCluster(
  id: string,
  articles: ClusterArticle[],
  centroid: number[]
): Promise<void> {
  await db
    .collection("clusters")
    .doc(id)
    .update({
      articles,
      centroid,
      articleCount: articles.length,
      isSingleton: articles.length === 1,
      updatedAt: FieldValue.serverTimestamp(),
    })
}
