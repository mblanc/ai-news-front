import { describe, it, expect, vi } from "vitest"
import {
  executeWorkerTask,
  parseAgyStreamResult,
  parseEbur128IntegratedLufs,
  type WorkerRunnerDeps,
} from "@/lib/video/worker-runner"
import { createDigestVideoRepo, type VideoFirestoreAdapter } from "@/lib/video/repo"
import type { Digest } from "@/lib/types"

function makeDigest(): Digest {
  return {
    scope: "daily",
    category: "all",
    generatedAt: new Date("2026-11-10T14:01:38.573Z"),
    headline: "Frontier AI Races Toward Wall Street",
    insights: [
      {
        text: "Anthropic launches IPO roadshow",
        category: "industry-news",
        sources: [
          {
            title: "Anthropic IPO roadshow",
            domain: "anthropic.com",
            sourceName: "Anthropic",
            url: "https://anthropic.com/news/roadshow",
          },
        ],
      },
    ],
  }
}

function makeFakeDeps(overrides: Partial<WorkerRunnerDeps> = {}) {
  const savedDocs = new Map<string, Record<string, unknown>>()
  const adapter: VideoFirestoreAdapter = {
    async setDoc(id, data) {
      savedDocs.set(id, data)
    },
    async getDoc(id) {
      return savedDocs.get(id) ?? null
    },
    async queryLatestReady() {
      return null
    },
    async appendFeedback() {},
  }
  const cleanup = vi.fn(async () => {})
  const uploadArtifacts = vi.fn(async () => ({
    gcsVideoPath: "videos/2026-11-10/daily/all/briefing.mp4",
    gcsPosterPath: "videos/2026-11-10/daily/all/poster.jpg",
    gcsManifestPath: "videos/2026-11-10/daily/all/manifest.json",
  }))

  const deps: WorkerRunnerDeps = {
    createWorkDir: vi.fn(async () => "/tmp/job-test-0"),
    removeWorkDir: cleanup,
    getDigest: vi.fn(async () => makeDigest()),
    runAgyHeadless: vi.fn(async () => ({
      projectDir: "/tmp/job-test-0/out",
      mp4Path: "/tmp/job-test-0/out/raw.mp4",
      criticVerdict: "OURS WINS" as const,
      criticRounds: 2,
      criticNotes: "NONE",
      sourcesManifestPath: "/tmp/job-test-0/out/sources-manifest.json",
    })),
    verifyAndMasterMedia: vi.fn(async () => ({
      finalMp4Path: "/tmp/job-test-0/out/briefing.mp4",
      posterJpgPath: "/tmp/job-test-0/out/poster.jpg",
      durationSec: 88.5,
      lufs: -16.2,
    })),
    uploadArtifacts,
    videoRepo: createDigestVideoRepo(adapter),
    ...overrides,
  }

  return { deps, savedDocs, cleanup, uploadArtifacts }
}

describe("executeWorkerTask (Task 4 runner envelope)", () => {
  it("runs agy headless, normalizes media, uploads to GCS, saves ready doc, and cleans temp dir", async () => {
    const { deps, savedDocs, cleanup } = makeFakeDeps()
    const doc = await executeWorkerTask({ taskIndex: 0, dateStr: "2026-11-10" }, deps)

    expect(doc.category).toBe("all")
    expect(doc.status).toBe("ready")
    expect(doc.durationSec).toBe(88.5)
    expect(doc.criticVerdict).toBe("OURS WINS")
    expect(savedDocs.has("2026-11-10_daily_all")).toBe(true)
    expect(cleanup).toHaveBeenCalledWith("/tmp/job-test-0")
  })

  it("still publishes latest valid render when critic exhausts rounds with NEEDS_REVIEW", async () => {
    const { deps, savedDocs } = makeFakeDeps({
      runAgyHeadless: vi.fn(async () => ({
        projectDir: "/tmp/job-test-0/out",
        mp4Path: "/tmp/job-test-0/out/raw.mp4",
        criticVerdict: "NEEDS_REVIEW" as const,
        criticRounds: 3,
        criticNotes: "Secondary sub-label wrap on card 3",
        sourcesManifestPath: "/tmp/job-test-0/out/sources-manifest.json",
      })),
    })

    const doc = await executeWorkerTask({ taskIndex: 0, dateStr: "2026-11-10" }, deps)
    expect(doc.status).toBe("ready")
    expect(doc.criticVerdict).toBe("NEEDS_REVIEW")
    expect(doc.criticRounds).toBe(3)
    expect(doc.criticNotes).toContain("card 3")
    expect(savedDocs.has("2026-11-10_daily_all")).toBe(true)
  })

  it("rejects videos exceeding 120s without publishing and still cleans temp dir", async () => {
    const { deps, savedDocs, cleanup, uploadArtifacts } = makeFakeDeps({
      verifyAndMasterMedia: vi.fn(async () => ({
        finalMp4Path: "/tmp/job-test-0/out/briefing.mp4",
        posterJpgPath: "/tmp/job-test-0/out/poster.jpg",
        durationSec: 124.2,
        lufs: -16.0,
      })),
    })

    await expect(executeWorkerTask({ taskIndex: 0, dateStr: "2026-11-10" }, deps)).rejects.toThrow(
      /exceeds hard cap/
    )
    expect(uploadArtifacts).not.toHaveBeenCalled()
    expect(savedDocs.size).toBe(0)
    expect(cleanup).toHaveBeenCalledWith("/tmp/job-test-0")
  })

  it("cleans up temp dir even when agy subprocess fails", async () => {
    const { deps, cleanup, savedDocs } = makeFakeDeps({
      runAgyHeadless: vi.fn(async () => {
        throw new Error("agy exited with code 1")
      }),
    })

    await expect(executeWorkerTask({ taskIndex: 1, dateStr: "2026-11-10" }, deps)).rejects.toThrow(
      /agy exited/
    )
    expect(savedDocs.size).toBe(0)
    expect(cleanup).toHaveBeenCalledWith("/tmp/job-test-0")
  })
})

describe("parseAgyStreamResult", () => {
  it("parses final NDJSON result event from stream-json output", () => {
    const ndjson = [
      JSON.stringify({ event: "init", conversation_id: "c1" }),
      JSON.stringify({ event: "step_update", step_update: { step_index: 1, state: "DONE" } }),
      JSON.stringify({
        event: "result",
        result: {
          status: "SUCCESS",
          structured_output: {
            projectDir: "/tmp/job/project",
            mp4Path: "/tmp/job/project/raw.mp4",
            criticVerdict: "OURS WINS",
            criticRounds: 1,
            criticNotes: "Sharp alignment.",
            sourcesManifestPath: "/tmp/job/project/sources-manifest.json",
          },
        },
      }),
    ].join("\n")

    const parsed = parseAgyStreamResult(ndjson)
    expect(parsed.criticVerdict).toBe("OURS WINS")
    expect(parsed.criticRounds).toBe(1)
  })
})

describe("parseEbur128IntegratedLufs", () => {
  it("extracts Summary integrated loudness instead of initial -70 LUFS progress lines", () => {
    const sample = [
      "[Parsed_ebur128_0] t: 0.09999   TARGET:-23 LUFS   I: -70.0 LUFS",
      "[Parsed_ebur128_0] t: 74.99999  TARGET:-23 LUFS   I: -16.2 LUFS",
      "[Parsed_ebur128_0] Summary:",
      "  Integrated loudness:",
      "    I:         -16.2 LUFS",
    ].join("\n")

    expect(parseEbur128IntegratedLufs(sample)).toBe(-16.2)
  })
})
