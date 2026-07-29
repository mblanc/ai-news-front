import { createProductionIngestionPipeline } from "@/lib/ingestion-pipeline"
import { DigestGenerator, createProductionDigestGenerator } from "@/lib/digest-generator"
import { db } from "@/lib/firebase"
import type { Cluster, Digest, DigestScope, IngestStats, SourceCategory } from "@/lib/types"

export type { IngestStats } from "@/lib/types"

const LOCK_DOC = "_locks/ingest"
const LOCK_TTL_MS = 15 * 60 * 1000

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

/**
 * Main ingestion entrypoint — delegates to IngestionPipeline with distributed lock.
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
  log(`Generating digest for scope: ${scope}...`)
  const generator = createProductionDigestGenerator()
  const digest = await generator.generateDigest(scope, category)
  log(`Digest generated: "${digest.headline}"`)
  return digest
}

export async function generateWeeklyDigest(
  log: (msg: string) => void = console.log,
  _force?: boolean
): Promise<Digest> {
  return generateAndSaveDigest(log, "weekly")
}

export async function generateMonthlyDigest(
  log: (msg: string) => void = console.log,
  _force?: boolean
): Promise<Digest> {
  return generateAndSaveDigest(log, "monthly")
}

export async function generateAllTimeOverview(
  log: (msg: string) => void = console.log,
  _force?: boolean
): Promise<Digest> {
  return generateAndSaveDigest(log, "overview")
}

export async function seedAllDigests(log: (msg: string) => void = console.log): Promise<void> {
  log("Seeding all digests...")
  await generateAndSaveDigest(log, "daily")
  await generateWeeklyDigest(log)
  await generateMonthlyDigest(log)
  await generateAllTimeOverview(log)
  log("All digests seeded successfully.")
}

export async function checkAndRefreshMultiScopeDigests(
  log: (msg: string) => void = console.log
): Promise<void> {
  log("Checking multi-scope digests status...")
  await generateAndSaveDigest(log, "daily")
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
