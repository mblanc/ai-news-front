import type { Digest, DigestSource, GroundedInsight } from "@/lib/types"
import { VIDEO_CATEGORIES, type VideoCategory } from "@/lib/video/types"

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "source",
  "fbclid",
  "gclid",
])

const GENERIC_ENTITIES = new Set([
  "Google",
  "Google DeepMind",
  "DeepMind",
  "OpenAI",
  "Anthropic",
  "Meta",
  "Microsoft",
  "Apple",
  "Nvidia",
  "Amazon",
  "Tech",
  "Physical AI",
  "Frontier AI",
  "Automated",
  "Local",
])

export interface DeduplicatedInsight extends GroundedInsight {
  categories: VideoCategory[]
  perspectives?: string[]
}

export interface CanonicalMergedDigest {
  headline: string
  generatedAt: Date
  rawInsightCount: number
  insights: DeduplicatedInsight[]
}

export function normalizeStoryUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) return ""
  try {
    const parsed = new URL(trimmed)
    parsed.hash = ""
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "")
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
        parsed.searchParams.delete(key)
      }
    }
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "")
    }
    return parsed.toString()
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, "")
  }
}

/**
 * Extracts specific multi-word product/model/event names (e.g. "Gemini Robotics 2.5", "AlphaProof Code", "MiniMax H3").
 */
export function extractSpecificEntities(text: string): Set<string> {
  const out = new Set<string>()
  const matches = text.matchAll(
    /\b([A-Z][A-Za-z0-9-]+(?:\s+(?:[A-Z][A-Za-z0-9.-]*|\d+(?:\.\d+)?)){1,3})\b/g
  )
  for (const m of matches) {
    const phrase = m[1].trim()
    if (phrase.length < 6 || GENERIC_ENTITIES.has(phrase)) continue
    out.add(phrase.toLowerCase())
  }
  return out
}

interface RawItem {
  category: VideoCategory
  orderIndex: number
  text: string
  sources: DigestSource[]
  normalizedUrls: Set<string>
  entities: Set<string>
}

interface StoryCluster {
  cats: Set<VideoCategory>
  seedUrls: Set<string>
  allUrls: Set<string>
  entities: Set<string>
  items: RawItem[]
}

function countIntersection(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let count = 0
  for (const val of a) {
    if (b.has(val)) count++
  }
  return count
}

export function mergeAndDeduplicateDigests(
  digestsByCategory: Partial<Record<VideoCategory, Digest | null | undefined>>
): CanonicalMergedDigest {
  const items: RawItem[] = []
  let canonicalHeadline = ""
  let latestGeneratedAt = new Date(0)

  const orderedCategories: VideoCategory[] = [
    "all",
    "frontier-research",
    "ai-engineering",
    "genmedia",
    "ecosystem-analysis",
    "industry-news",
  ]

  for (const category of orderedCategories) {
    const digest = digestsByCategory[category]
    if (!digest || !Array.isArray(digest.insights) || digest.insights.length === 0) continue

    if (category === "all" && digest.headline) {
      canonicalHeadline = digest.headline
    } else if (!canonicalHeadline && digest.headline) {
      canonicalHeadline = digest.headline
    }

    const genDate =
      digest.generatedAt instanceof Date ? digest.generatedAt : new Date(String(digest.generatedAt))
    if (!Number.isNaN(genDate.getTime()) && genDate > latestGeneratedAt) {
      latestGeneratedAt = genDate
    }

    for (const raw of digest.insights) {
      const text = typeof raw === "string" ? raw.trim() : raw.text.trim()
      if (!text) continue
      const sources = typeof raw === "string" ? [] : Array.isArray(raw.sources) ? raw.sources : []
      const normalizedUrls = new Set<string>()
      for (const src of sources) {
        const norm = normalizeStoryUrl(src.url)
        if (norm) normalizedUrls.add(norm)
      }
      items.push({
        category,
        orderIndex: items.length,
        text,
        sources,
        normalizedUrls,
        entities: extractSpecificEntities(text),
      })
    }
  }

  if (items.length === 0) {
    throw new Error("No populated daily digests found across any category")
  }

  // Pass 1: Assign each insight to its highest-overlap existing cluster (never merging two items from the same digest)
  const clusters: StoryCluster[] = []
  for (const item of items) {
    let bestIdx = -1
    let bestScore = 0

    for (let c = 0; c < clusters.length; c++) {
      const cluster = clusters[c]
      if (cluster.cats.has(item.category)) continue

      const sharedUrls = countIntersection(cluster.seedUrls, item.normalizedUrls)
      const minUrls = Math.min(cluster.seedUrls.size, item.normalizedUrls.size)
      const urlOverlap = minUrls > 0 ? sharedUrls / minUrls : 0
      const sharedEntities = countIntersection(cluster.entities, item.entities)

      const isDuplicate =
        urlOverlap >= 0.5 || (sharedUrls >= 1 && sharedEntities >= 1) || sharedEntities >= 2

      if (isDuplicate) {
        const score = urlOverlap + sharedEntities * 0.25
        if (score > bestScore) {
          bestScore = score
          bestIdx = c
        }
      }
    }

    if (bestIdx >= 0) {
      const target = clusters[bestIdx]
      target.cats.add(item.category)
      target.items.push(item)
      for (const u of item.normalizedUrls) target.allUrls.add(u)
      for (const e of item.entities) target.entities.add(e)
    } else {
      clusters.push({
        cats: new Set([item.category]),
        seedUrls: new Set(item.normalizedUrls),
        allUrls: new Set(item.normalizedUrls),
        entities: new Set(item.entities),
        items: [item],
      })
    }
  }

  // Pass 2: Prune singleton composite bullets whose URLs are >= 50% already covered by earlier clusters
  const coveredUrls = new Set<string>()
  const survivingClusters: StoryCluster[] = []
  for (const cluster of clusters) {
    if (cluster.items.length === 1 && cluster.seedUrls.size > 0) {
      const alreadyCovered = countIntersection(cluster.seedUrls, coveredUrls)
      if (alreadyCovered / cluster.seedUrls.size >= 0.5) {
        continue
      }
    }
    survivingClusters.push(cluster)
    for (const u of cluster.allUrls) coveredUrls.add(u)
  }

  const mergedInsights: Array<{
    insight: DeduplicatedInsight
    hasAll: boolean
    firstIndex: number
  }> = []

  for (const cluster of survivingClusters) {
    const categories = VIDEO_CATEGORIES.filter((c) => cluster.cats.has(c))
    const primaryItem = cluster.items.find((g) => g.category === "all") ?? cluster.items[0]
    const perspectives: string[] = []
    for (const g of cluster.items) {
      if (g === primaryItem) continue
      if (g.text !== primaryItem.text && !perspectives.includes(g.text)) {
        perspectives.push(g.text)
      }
    }

    const seenUrls = new Set<string>()
    const mergedSources: DigestSource[] = []
    for (const g of cluster.items) {
      for (const src of g.sources) {
        const norm = normalizeStoryUrl(src.url)
        if (!norm || seenUrls.has(norm)) continue
        seenUrls.add(norm)
        mergedSources.push(src)
      }
    }

    const firstNonAllCategory = categories.find((c) => c !== "all")
    mergedInsights.push({
      insight: {
        text: primaryItem.text,
        ...(firstNonAllCategory ? { category: firstNonAllCategory } : {}),
        categories,
        ...(perspectives.length > 0 ? { perspectives } : {}),
        sources: mergedSources,
      },
      hasAll: cluster.cats.has("all"),
      firstIndex: cluster.items[0].orderIndex,
    })
  }

  mergedInsights.sort((a, b) => {
    if (b.insight.categories.length !== a.insight.categories.length) {
      return b.insight.categories.length - a.insight.categories.length
    }
    if (a.hasAll !== b.hasAll) return a.hasAll ? -1 : 1
    return a.firstIndex - b.firstIndex
  })

  return {
    headline: canonicalHeadline || "Daily State of AI Briefing",
    generatedAt: latestGeneratedAt.getTime() > 0 ? latestGeneratedAt : new Date(),
    rawInsightCount: items.length,
    insights: mergedInsights.map((m) => m.insight),
  }
}
