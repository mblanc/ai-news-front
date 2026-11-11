import { describe, it, expect } from "vitest"
import {
  VIDEO_CATEGORIES,
  buildVideoDocId,
  resolveCategoryFromTaskIndex,
  validateAgyResult,
  type AgyResult,
  type VideoDocument,
} from "@/lib/video/types"
import { createDigestVideoRepo, type VideoFirestoreAdapter } from "@/lib/video/repo"

function createFakeStore(initial: Record<string, Record<string, unknown>> = {}): {
  store: Map<string, Record<string, unknown>>
  adapter: VideoFirestoreAdapter
} {
  const store = new Map<string, Record<string, unknown>>(Object.entries(initial))
  const adapter: VideoFirestoreAdapter = {
    async setDoc(id, data) {
      store.set(id, { ...(store.get(id) ?? {}), ...data })
    },
    async getDoc(id) {
      return store.get(id) ?? null
    },
    async queryLatestReady(scope, category) {
      const matches = Array.from(store.entries())
        .map(([id, data]) => ({ id, ...data }) as VideoDocument & { id: string })
        .filter(
          (doc) => doc.digestId === scope && doc.category === category && doc.status === "ready"
        )
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
      return matches[0] ?? null
    },
    async appendFeedback(id, entry) {
      const existing = store.get(id)
      if (!existing) throw new Error(`Video ${id} not found`)
      const current = Array.isArray(existing.humanFeedback) ? existing.humanFeedback : []
      store.set(id, { ...existing, humanFeedback: [...current, entry] })
    },
  }
  return { store, adapter }
}

describe("video types and task index mapping", () => {
  it("maps Cloud Run task indices 0..5 to all 6 categories deterministically", () => {
    expect(VIDEO_CATEGORIES).toEqual([
      "all",
      "ai-engineering",
      "frontier-research",
      "genmedia",
      "ecosystem-analysis",
      "industry-news",
    ])
    expect(resolveCategoryFromTaskIndex(0)).toBe("all")
    expect(resolveCategoryFromTaskIndex(5)).toBe("industry-news")
    expect(() => resolveCategoryFromTaskIndex(-1)).toThrow(/Invalid CLOUD_RUN_TASK_INDEX/)
    expect(() => resolveCategoryFromTaskIndex(6)).toThrow(/Invalid CLOUD_RUN_TASK_INDEX/)
    expect(() => resolveCategoryFromTaskIndex(Number.NaN)).toThrow(/Invalid CLOUD_RUN_TASK_INDEX/)
  })

  it("builds stable Firestore doc IDs", () => {
    expect(buildVideoDocId("2026-11-10", "daily", "all")).toBe("2026-11-10_daily_all")
    expect(buildVideoDocId("2026-11-10", "daily", "frontier-research")).toBe(
      "2026-11-10_daily_frontier-research"
    )
  })

  it("validates AgyResult strictly and caps criticRounds to supported enum values", () => {
    const valid: AgyResult = {
      projectDir: "/tmp/job/out",
      mp4Path: "/tmp/job/out/raw.mp4",
      criticVerdict: "NEEDS_REVIEW",
      criticRounds: 3,
      criticNotes: "Minor bottom alignment drift on card 2",
      sourcesManifestPath: "/tmp/job/out/sources-manifest.json",
    }
    expect(validateAgyResult(valid)).toEqual(valid)
    expect(() => validateAgyResult({ ...valid, mp4Path: "" })).toThrow()
  })
})

describe("digest_videos repository", () => {
  it("persists private GCS paths only, fetches latest ready video, and records feedback", async () => {
    const { store, adapter } = createFakeStore()
    const repo = createDigestVideoRepo(adapter)

    const saved = await repo.saveReady({
      date: "2026-11-10",
      digestId: "daily",
      category: "all",
      gcsVideoPath: "videos/2026-11-10/daily/all/briefing.mp4",
      gcsPosterPath: "videos/2026-11-10/daily/all/poster.jpg",
      gcsManifestPath: "videos/2026-11-10/daily/all/manifest.json",
      durationSec: 92.1,
      lufs: -16.3,
      headline: "Markets, Chips & Proof Frontiers",
      insightCount: 5,
      criticVerdict: "OURS WINS",
      criticRounds: 2,
      criticNotes: "NONE",
    })

    expect(saved.id).toBe("2026-11-10_daily_all")
    expect(saved.status).toBe("ready")
    expect((store.get(saved.id) as Record<string, unknown>).videoUrl).toBeUndefined()

    const latest = await repo.getLatestReady("daily", "all")
    expect(latest?.id).toBe("2026-11-10_daily_all")
    expect(latest?.criticVerdict).toBe("OURS WINS")

    await repo.addFeedback(saved.id, {
      rating: "up",
      note: "Crisp METR chart",
      updatedBy: "mblanc@google.com",
    })
    const fetched = await repo.getById(saved.id)
    expect(fetched?.humanFeedback).toHaveLength(1)
    expect(fetched?.humanFeedback?.[0]?.rating).toBe("up")
  })

  it("rejects raw public https URLs in gcs paths", async () => {
    const { adapter } = createFakeStore()
    const repo = createDigestVideoRepo(adapter)
    await expect(
      repo.saveReady({
        date: "2026-11-10",
        digestId: "daily",
        category: "all",
        gcsVideoPath: "https://storage.googleapis.com/bucket/video.mp4",
        gcsPosterPath: "videos/2026-11-10/daily/all/poster.jpg",
        durationSec: 80,
        lufs: -16,
        headline: "Headline",
        insightCount: 3,
        criticVerdict: "OURS WINS",
        criticRounds: 1,
        criticNotes: "",
      })
    ).rejects.toThrow(/object path/)
  })
})
