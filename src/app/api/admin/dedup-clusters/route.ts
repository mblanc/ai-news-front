import { NextResponse } from "next/server"
import { FieldValue } from "@google-cloud/firestore"
import { db } from "@/lib/firebase"
import { cosineSimilarity } from "@/lib/cluster"
import type { ClusterArticle } from "@/lib/types"

const DEDUP_THRESHOLD = 0.82

interface RawCluster {
  id: string
  centroid: number[]
  articles: ClusterArticle[]
  createdAt: { toMillis(): number } | null
  isSingleton: boolean
  summary: string
  topicTag: string
  sentiment: string
  entities: string[]
  articleCount: number
  publishedAt: unknown
}

export async function POST() {
  // Load all clusters — filter in memory since Firestore can't query on array fields
  const snap = await db.collection("clusters").orderBy("createdAt", "asc").get()

  const clusters: RawCluster[] = snap.docs
    .map((d) => {
      const data = d.data()
      return {
        id: d.id,
        centroid: Array.isArray(data.centroid) ? (data.centroid as number[]) : [],
        articles: (data.articles ?? []) as ClusterArticle[],
        createdAt: data.createdAt ?? null,
        isSingleton: data.isSingleton ?? false,
        summary: data.summary ?? "",
        topicTag: data.topicTag ?? "other",
        sentiment: data.sentiment ?? "neutral",
        entities: data.entities ?? [],
        articleCount: data.articleCount ?? 0,
        publishedAt: data.publishedAt ?? null,
      }
    })
    .filter((c) => c.centroid.length > 0) // skip clusters without embeddings

  // Greedily group clusters by centroid similarity
  // Each group[i] is an array of cluster indices belonging to that group.
  // The first element of each group is the canonical (oldest, since sorted by createdAt asc).
  const groupCentroids: number[][] = []
  const groups: number[][] = []

  for (let i = 0; i < clusters.length; i++) {
    let bestGroup = -1
    let bestSim = -1
    for (let g = 0; g < groupCentroids.length; g++) {
      const sim = cosineSimilarity(clusters[i].centroid, groupCentroids[g])
      if (sim > bestSim) {
        bestSim = sim
        bestGroup = g
      }
    }

    if (bestGroup >= 0 && bestSim >= DEDUP_THRESHOLD) {
      groups[bestGroup].push(i)
      // Update group centroid as mean of member centroids
      const members = groups[bestGroup].map((idx) => clusters[idx].centroid)
      const len = members[0].length
      const mean = new Array<number>(len).fill(0)
      for (const v of members) for (let k = 0; k < len; k++) mean[k] += v[k]
      groupCentroids[bestGroup] = mean.map((v) => v / members.length)
    } else {
      groupCentroids.push([...clusters[i].centroid])
      groups.push([i])
    }
  }

  // Only process groups with more than one cluster (actual duplicates)
  const dupGroups = groups.filter((g) => g.length > 1)

  if (dupGroups.length === 0) {
    return NextResponse.json({ merged: 0, deleted: 0, message: "No duplicate clusters found." })
  }

  let totalDeleted = 0

  for (const group of dupGroups) {
    // group[0] is canonical (oldest createdAt, since we sorted asc)
    const canonical = clusters[group[0]]
    const duplicates = group.slice(1).map((idx) => clusters[idx])

    // Merge all articles, deduplicated by ID
    const seenIds = new Set<string>(canonical.articles.map((a) => a.id))
    const mergedArticles = [...canonical.articles]
    for (const dup of duplicates) {
      for (const article of dup.articles) {
        if (!seenIds.has(article.id)) {
          seenIds.add(article.id)
          mergedArticles.push(article)
        }
      }
    }

    // Update canonical cluster
    await db
      .collection("clusters")
      .doc(canonical.id)
      .update({
        articles: mergedArticles,
        articleCount: mergedArticles.length,
        isSingleton: mergedArticles.length === 1,
        updatedAt: FieldValue.serverTimestamp(),
      })

    // Delete the duplicates
    for (const dup of duplicates) {
      await db.collection("clusters").doc(dup.id).delete()
    }

    totalDeleted += duplicates.length
  }

  return NextResponse.json({
    merged: dupGroups.length,
    deleted: totalDeleted,
    message: `Merged ${dupGroups.length} duplicate group${dupGroups.length === 1 ? "" : "s"}, deleted ${totalDeleted} cluster${totalDeleted === 1 ? "" : "s"}.`,
  })
}
