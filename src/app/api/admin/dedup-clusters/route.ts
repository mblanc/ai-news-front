import { NextResponse } from "next/server"
import { FieldValue } from "@google-cloud/firestore"
import { db } from "@/lib/firebase"
import { cosineSimilarity, toClusterArticle } from "@/lib/cluster"
import type { ClusterArticle } from "@/lib/types"

const DEDUP_THRESHOLD = 0.82
const MAX_TIME_DIFF_MS = 7 * 24 * 60 * 60 * 1000 // 7 days window for duplicate news stories
const MAX_CLUSTER_ARTICLES = 100 // Safety cap against document limit

interface RawCluster {
  id: string
  centroid: number[]
  articles: ClusterArticle[]
  createdAtMillis: number
  isSingleton: boolean
  summary: string
  topicTag: string
  sentiment: string
  entities: string[]
  articleCount: number
  publishedAt: unknown
}

export async function POST() {
  try {
    // Load all clusters — filter in memory since Firestore can't query on array fields
    const snap = await db.collection("clusters").orderBy("createdAt", "asc").get()

    const clusters: RawCluster[] = snap.docs
      .map((d) => {
        const data = d.data()
        let createdAtMillis = 0
        if (data.createdAt?.toMillis) {
          createdAtMillis = data.createdAt.toMillis()
        } else if (data.createdAt) {
          createdAtMillis = new Date(data.createdAt).getTime()
        }

        return {
          id: d.id,
          centroid: Array.isArray(data.centroid) ? (data.centroid as number[]) : [],
          articles: (data.articles ?? []) as ClusterArticle[],
          createdAtMillis,
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

    // Greedily group clusters by centroid similarity against the canonical cluster
    // The first element of each group is the canonical (oldest, since sorted by createdAt asc).
    const groups: number[][] = []

    for (let i = 0; i < clusters.length; i++) {
      let bestGroup = -1
      let bestSim = -1
      for (let g = 0; g < groups.length; g++) {
        const canonical = clusters[groups[g][0]]

        // Breaking news duplicates only occur within a bounded time window
        if (
          canonical.createdAtMillis &&
          clusters[i].createdAtMillis &&
          Math.abs(clusters[i].createdAtMillis - canonical.createdAtMillis) > MAX_TIME_DIFF_MS
        ) {
          continue
        }

        const sim = cosineSimilarity(clusters[i].centroid, canonical.centroid)
        if (sim > bestSim) {
          bestSim = sim
          bestGroup = g
        }
      }

      if (bestGroup >= 0 && bestSim >= DEDUP_THRESHOLD) {
        groups[bestGroup].push(i)
        // NOTE: We do NOT update the group centroid to the mean of all members.
        // Keeping it anchored to canonical.centroid prevents centroid drift / snowballing
        // where hundreds of unrelated clusters gradually get pulled into a single massive group.
      } else {
        groups.push([i])
      }
    }

    // Only process groups with more than one cluster (actual duplicates)
    const dupGroups = groups.filter((g) => g.length > 1)

    if (dupGroups.length === 0) {
      return NextResponse.json({ merged: 0, deleted: 0, message: "No duplicate clusters found." })
    }

    let totalDeleted = 0
    const BATCH_SIZE = 25
    let batch = db.batch()
    let opCount = 0

    for (const group of dupGroups) {
      // group[0] is canonical (oldest createdAt, since we sorted asc)
      const canonical = clusters[group[0]]
      const duplicates = group.slice(1).map((idx) => clusters[idx])

      // Merge all articles, deduplicated by ID and sanitized to ClusterArticle fields.
      // This strips any bloated fields (like raw bodyMd or embedding) to guarantee
      // the document remains well under Firestore's 1MB limit.
      const seenIds = new Set<string>()
      const mergedArticles: ClusterArticle[] = []

      for (const article of [...canonical.articles, ...duplicates.flatMap((d) => d.articles)]) {
        if (article?.id && !seenIds.has(article.id)) {
          seenIds.add(article.id)
          mergedArticles.push(toClusterArticle(article))
        }
      }

      const finalArticles = mergedArticles.slice(0, MAX_CLUSTER_ARTICLES)

      const canonicalRef = db.collection("clusters").doc(canonical.id)
      batch.update(canonicalRef, {
        articles: finalArticles,
        articleCount: finalArticles.length,
        isSingleton: finalArticles.length === 1,
        updatedAt: FieldValue.serverTimestamp(),
      })
      opCount++

      if (opCount >= BATCH_SIZE) {
        await batch.commit()
        batch = db.batch()
        opCount = 0
      }

      // Delete the duplicates
      for (const dup of duplicates) {
        const dupRef = db.collection("clusters").doc(dup.id)
        batch.delete(dupRef)
        opCount++

        if (opCount >= BATCH_SIZE) {
          await batch.commit()
          batch = db.batch()
          opCount = 0
        }
      }

      totalDeleted += duplicates.length
    }

    if (opCount > 0) {
      await batch.commit()
    }

    return NextResponse.json({
      merged: dupGroups.length,
      deleted: totalDeleted,
      message: `Merged ${dupGroups.length} duplicate group${dupGroups.length === 1 ? "" : "s"}, deleted ${totalDeleted} cluster${totalDeleted === 1 ? "" : "s"}.`,
    })
  } catch (error) {
    console.error("Error deduplicating clusters:", error)
    return NextResponse.json(
      { error: (error as Error).message || "Failed to deduplicate clusters" },
      { status: 500 }
    )
  }
}
