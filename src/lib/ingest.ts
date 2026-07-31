import { createProductionIngestionPipeline } from "@/lib/ingestion-pipeline"
import { DigestGenerator, createProductionDigestGenerator } from "@/lib/digest-generator"
import { db, getLatestDigest } from "@/lib/firebase"
import type { Cluster, Digest, DigestScope, IngestStats, SourceCategory } from "@/lib/types"

export type { IngestStats } from "@/lib/types"

const LOCK_DOC = "_locks/ingest"
const LOCK_TTL_MS = 15 * 60 * 1000

const CATEGORIES: (SourceCategory | "all")[] = [
  "all",
  "frontier-research",
  "ai-engineering",
  "ecosystem-analysis",
  "industry-news",
  "genmedia",
]

export function getParisCalendarInfo(date: Date = new Date()) {
  const dateStr = date.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" })
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    weekday: "short",
  }).format(date)
  const dayOfMonth = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Paris",
      day: "numeric",
    }).format(date),
    10
  )

  return {
    dateStr,
    isMonday: weekday === "Mon",
    isFirstOfMonth: dayOfMonth === 1,
  }
}

async function acquireIngestLock(): Promise<boolean> {
  const ref = db.doc(LOCK_DOC)
  const snap = await ref.get()
  if (snap.exists) {
    const data = snap.data()
    const acquiredAt = data?.acquiredAt?.toDate?.()?.getTime() ?? 0
    if (Date.now() - acquiredAt < LOCK_TTL_MS) {
      return false
    }
  }
  await ref.set({ acquiredAt: new Date() })
  return true
}

async function releaseIngestLock(): Promise<void> {
  await db.doc(LOCK_DOC).delete()
}

export async function refreshPostIngestDigests(
  stats: IngestStats,
  log: (msg: string) => void = console.log
): Promise<void> {
  const now = new Date()
  const { dateStr: todayParisStr, isMonday, isFirstOfMonth } = getParisCalendarInfo(now)

  const hasNewData = stats.clusters_created > 0 || stats.new_articles > 0

  // 1. Daily Digests (Every ingestion run if new articles/clusters ingested)
  if (hasNewData) {
    log("Step 10/10 — Refreshing Daily Digests for all categories (Europe/Paris)...")
    await Promise.all(
      CATEGORIES.map(async (cat) => {
        try {
          const categoryArg = cat === "all" ? undefined : cat
          await generateAndSaveDigest(log, "daily", categoryArg)
        } catch (err) {
          log(`  [Warning] Daily digest failed for ${cat}: ${(err as Error).message}`)
        }
      })
    )
  }

  // 2. Weekly & Field Overview Digests (Mondays in Paris if not yet generated today in Paris)
  if (isMonday) {
    const latestWeekly = await getLatestDigest("weekly")
    const weeklyDoneTodayInParis =
      latestWeekly && getParisCalendarInfo(latestWeekly.generatedAt).dateStr === todayParisStr

    if (!weeklyDoneTodayInParis) {
      log("  Monday (Europe/Paris) — Generating Weekly Digests & Field Overview...")
      await Promise.all(
        CATEGORIES.map(async (cat) => {
          try {
            const categoryArg = cat === "all" ? undefined : cat
            await generateAndSaveDigest(log, "weekly", categoryArg)
            await generateAndSaveDigest(log, "overview", categoryArg)
          } catch (err) {
            log(`  [Warning] Weekly/Overview digest failed for ${cat}: ${(err as Error).message}`)
          }
        })
      )
    }
  }

  // 3. Monthly Digests (1st of month in Paris if not yet generated today in Paris)
  if (isFirstOfMonth) {
    const latestMonthly = await getLatestDigest("monthly")
    const monthlyDoneTodayInParis =
      latestMonthly && getParisCalendarInfo(latestMonthly.generatedAt).dateStr === todayParisStr

    if (!monthlyDoneTodayInParis) {
      log("  1st of Month (Europe/Paris) — Generating Monthly Digests...")
      await Promise.all(
        CATEGORIES.map(async (cat) => {
          try {
            const categoryArg = cat === "all" ? undefined : cat
            await generateAndSaveDigest(log, "monthly", categoryArg)
          } catch (err) {
            log(`  [Warning] Monthly digest failed for ${cat}: ${(err as Error).message}`)
          }
        })
      )
    }
  }
}

/**
 * Main ingestion entrypoint — delegates to IngestionPipeline with distributed lock
 * and automatically refreshes multi-category digests.
 */
export async function runIngest(log: (msg: string) => void = console.log): Promise<IngestStats> {
  const start = Date.now()
  const locked = await acquireIngestLock()
  if (!locked) {
    log("Ingest already in progress — skipping (distributed lock held)")
    return {
      duration_ms: Date.now() - start,
      sources: 0,
      urls_found: 0,
      too_old: 0,
      new_articles: 0,
      discarded: 0,
      clustered: 0,
      clusters_created: 0,
    }
  }

  try {
    const pipeline = createProductionIngestionPipeline()
    const stats = await pipeline.ingest(undefined, {
      onProgress: (evt) => log(evt.message),
    })
    await refreshPostIngestDigests(stats, log)
    return stats
  } finally {
    await releaseIngestLock()
  }
}

/**
 * Concurrency helper function.
 */
export async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++
      try {
        results[currentIndex] = await fn(items[currentIndex])
      } catch (err) {
        throw err
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

/**
 * Digest entrypoints — delegate to DigestGenerator.
 */
export async function generateAndSaveDigest(
  log: (msg: string) => void = console.log,
  scope: DigestScope = "daily",
  category?: SourceCategory
): Promise<Digest> {
  log(`Generating digest for scope: ${scope}${category ? ` (${category})` : ""}...`)
  const generator = createProductionDigestGenerator()
  const digest = await generator.generateDigest(scope, category)
  log(`Digest generated: "${digest.headline}"`)
  return digest
}

export async function generateWeeklyDigest(
  log: (msg: string) => void = console.log,
  category?: SourceCategory
): Promise<Digest[]> {
  if (category) {
    const d = await generateAndSaveDigest(log, "weekly", category)
    return [d]
  }
  log("Generating Weekly Digests across all categories...")
  return Promise.all(
    CATEGORIES.map((cat) => generateAndSaveDigest(log, "weekly", cat === "all" ? undefined : cat))
  )
}

export async function generateMonthlyDigest(
  log: (msg: string) => void = console.log,
  category?: SourceCategory
): Promise<Digest[]> {
  if (category) {
    const d = await generateAndSaveDigest(log, "monthly", category)
    return [d]
  }
  log("Generating Monthly Digests across all categories...")
  return Promise.all(
    CATEGORIES.map((cat) => generateAndSaveDigest(log, "monthly", cat === "all" ? undefined : cat))
  )
}

export async function generateAllTimeOverview(
  log: (msg: string) => void = console.log,
  category?: SourceCategory
): Promise<Digest[]> {
  if (category) {
    const d = await generateAndSaveDigest(log, "overview", category)
    return [d]
  }
  log("Generating Overview Digests across all categories...")
  return Promise.all(
    CATEGORIES.map((cat) => generateAndSaveDigest(log, "overview", cat === "all" ? undefined : cat))
  )
}

export async function seedAllDigests(log: (msg: string) => void = console.log): Promise<void> {
  log("Seeding all digests across all scopes and categories...")
  await Promise.all(
    CATEGORIES.map(async (cat) => {
      const categoryArg = cat === "all" ? undefined : cat
      await generateAndSaveDigest(log, "daily", categoryArg)
      await generateAndSaveDigest(log, "weekly", categoryArg)
      await generateAndSaveDigest(log, "monthly", categoryArg)
      await generateAndSaveDigest(log, "overview", categoryArg)
    })
  )
  log("All multi-scope multi-category digests seeded successfully.")
}

export async function checkAndRefreshMultiScopeDigests(
  log: (msg: string) => void = console.log
): Promise<void> {
  const dummyStats: IngestStats = {
    duration_ms: 0,
    sources: 0,
    urls_found: 0,
    too_old: 0,
    new_articles: 1,
    discarded: 0,
    clustered: 1,
    clusters_created: 1,
  }
  await refreshPostIngestDigests(dummyStats, log)
}

export function computeClusterImpactScore(c: Cluster): number {
  const generator = new DigestGenerator({
    clusterRepository: { getClustersForScope: async () => [] },
    synthesizer: { synthesizeDigest: async () => ({}) as Digest },
    digestRepository: { saveDigest: async () => {} },
  })
  return generator.computeClusterImpactScore(c)
}

export function rankClustersByImportance(clusters: Cluster[]): Cluster[] {
  const generator = new DigestGenerator({
    clusterRepository: { getClustersForScope: async () => [] },
    synthesizer: { synthesizeDigest: async () => ({}) as Digest },
    digestRepository: { saveDigest: async () => {} },
  })
  return generator.rankClustersByImportance(clusters)
}

export function filterClustersByCategory(clusters: Cluster[], category: SourceCategory): Cluster[] {
  const generator = new DigestGenerator({
    clusterRepository: { getClustersForScope: async () => [] },
    synthesizer: { synthesizeDigest: async () => ({}) as Digest },
    digestRepository: { saveDigest: async () => {} },
  })
  return generator.filterClustersByCategory(clusters, category)
}
