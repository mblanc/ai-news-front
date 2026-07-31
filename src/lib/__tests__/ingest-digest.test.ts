import { describe, it, expect, vi } from "vitest"
import { getParisCalendarInfo, refreshPostIngestDigests } from "../ingest"
import type { IngestStats } from "../types"

vi.mock("../firebase", () => ({
  db: {
    doc: () => ({
      get: async () => ({ exists: false }),
      set: async () => {},
      delete: async () => {},
    }),
  },
  getLatestDigest: vi.fn().mockResolvedValue(null),
  saveDigest: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../digest-generator", () => ({
  createProductionDigestGenerator: () => ({
    generateDigest: async (scope: string, category?: string) => ({
      headline: `Mock Digest (${scope}, ${category ?? "all"})`,
      insights: [],
      generatedAt: new Date(),
      scope,
      category: category ?? "all",
    }),
  }),
  DigestGenerator: class {},
}))

describe("getParisCalendarInfo", () => {
  it("extracts correct date string and day information for Europe/Paris", () => {
    // 2026-07-29 is a Wednesday
    const date = new Date("2026-07-29T12:00:00Z")
    const info = getParisCalendarInfo(date)

    expect(info.dateStr).toBe("2026-07-29")
    expect(info.isMonday).toBe(false)
    expect(info.isFirstOfMonth).toBe(false)
  })

  it("correctly identifies Monday in Europe/Paris timezone", () => {
    // 2026-07-27 is a Monday
    const date = new Date("2026-07-27T10:00:00Z")
    const info = getParisCalendarInfo(date)

    expect(info.dateStr).toBe("2026-07-27")
    expect(info.isMonday).toBe(true)
    expect(info.isFirstOfMonth).toBe(false)
  })

  it("correctly identifies 1st of month in Europe/Paris timezone", () => {
    // 2026-08-01 is 1st of month
    const date = new Date("2026-08-01T10:00:00Z")
    const info = getParisCalendarInfo(date)

    expect(info.dateStr).toBe("2026-08-01")
    expect(info.isFirstOfMonth).toBe(true)
  })
})

describe("refreshPostIngestDigests", () => {
  it("triggers daily digests across all 5 categories when new clusters are created", async () => {
    const logSpy = vi.fn()
    const stats: IngestStats = {
      duration_ms: 1000,
      sources: 10,
      urls_found: 20,
      too_old: 0,
      new_articles: 5,
      discarded: 0,
      clustered: 5,
      clusters_created: 2,
    }

    await refreshPostIngestDigests(stats, logSpy)

    expect(logSpy).toHaveBeenCalledWith(
      "Step 10/10 — Refreshing Daily Digests for all categories (Europe/Paris)..."
    )
  })
})
