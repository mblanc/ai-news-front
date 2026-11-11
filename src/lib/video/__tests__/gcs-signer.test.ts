import { describe, it, expect, vi } from "vitest"
import { NextRequest } from "next/server"
import crypto from "node:crypto"
import { mintV4SignedUrl } from "@/lib/video/gcs-signer"
import { handleLatestVideoRequest } from "@/app/api/videos/latest/route"
import { handleVideoUrlRequest } from "@/app/api/videos/[id]/url/route"
import type { VideoDocument } from "@/lib/video/types"

function makeReadyVideo(): VideoDocument {
  return {
    id: "2026-11-11_daily_all",
    digestId: "daily",
    category: "all",
    date: "2026-11-11",
    headline: "Frontier AI Races Toward Wall Street",
    insightCount: 4,
    status: "ready",
    gcsVideoPath: "videos/2026-11-11/daily/all/briefing.mp4",
    gcsPosterPath: "videos/2026-11-11/daily/all/poster.jpg",
    gcsManifestPath: "videos/2026-11-11/daily/all/manifest.json",
    durationSec: 88.4,
    lufs: -16.1,
    criticVerdict: "OURS WINS",
    criticNotes: "Strong contrast and pacing.",
    criticRounds: 2,
    generatedAt: "2026-11-11T08:05:00Z",
  }
}

describe("mintV4SignedUrl", () => {
  it("constructs canonical GCS V4 signed URL using injected IAM signBlob and caps TTL", async () => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 })
    const signBlob = vi.fn(async (payload: Buffer) =>
      crypto.sign("RSA-SHA256", payload, privateKey)
    )
    const now = new Date("2026-11-11T09:00:00Z")

    const result = await mintV4SignedUrl(
      {
        bucket: "ai-news-videos-private",
        objectPath: "videos/2026-11-11/daily/all/briefing.mp4",
        expiresInSeconds: 3600,
        now,
      },
      {
        serviceAccountEmail: "web@svc-demo-vertex.iam.gserviceaccount.com",
        signBlob,
      }
    )

    expect(signBlob).toHaveBeenCalledTimes(1)
    const parsed = new URL(result.url)
    expect(parsed.origin).toBe("https://storage.googleapis.com")
    expect(parsed.pathname).toBe("/ai-news-videos-private/videos/2026-11-11/daily/all/briefing.mp4")
    expect(parsed.searchParams.get("X-Goog-Algorithm")).toBe("GOOG4-RSA-SHA256")
    expect(parsed.searchParams.get("X-Goog-Credential")).toBe(
      "web@svc-demo-vertex.iam.gserviceaccount.com/20261111/auto/storage/goog4_request"
    )
    expect(parsed.searchParams.get("X-Goog-Date")).toBe("20261111T090000Z")
    expect(parsed.searchParams.get("X-Goog-Expires")).toBe("3600")
    expect(parsed.searchParams.get("X-Goog-SignedHeaders")).toBe("host")
    expect(parsed.searchParams.get("X-Goog-Signature")).toMatch(/^[0-9a-f]{512}$/)
    expect(result.expiresAt.toISOString()).toBe("2026-11-11T10:00:00.000Z")
  })

  it("rejects traversal object paths", async () => {
    await expect(
      mintV4SignedUrl(
        { bucket: "b", objectPath: "../secret.mp4" },
        {
          serviceAccountEmail: "sa@p.iam.gserviceaccount.com",
          signBlob: async () => Buffer.from("x"),
        }
      )
    ).rejects.toThrow(/Invalid GCS object path/)
  })
})

describe("GET /api/videos/latest", () => {
  it("returns 404 when no ready video exists for today", async () => {
    const req = new NextRequest("http://localhost:3000/api/videos/latest?scope=daily&category=all")
    const res = await handleLatestVideoRequest(req, {
      todayDateStr: "2026-11-11",
      getReadyForDate: vi.fn(async () => null),
    })
    expect(res.status).toBe(404)
  })

  it("returns 404 for non-canonical sub-categories (e.g. genmedia)", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/videos/latest?scope=daily&category=genmedia"
    )
    const res = await handleLatestVideoRequest(req, {
      todayDateStr: "2026-11-11",
      getReadyForDate: vi.fn(async () => makeReadyVideo()),
    })
    expect(res.status).toBe(404)
  })

  it("returns 404 when available video is from yesterday instead of today", async () => {
    const staleDoc = { ...makeReadyVideo(), id: "2026-11-10_daily_all", date: "2026-11-10" }
    const req = new NextRequest("http://localhost:3000/api/videos/latest?scope=daily&category=all")
    const res = await handleLatestVideoRequest(req, {
      todayDateStr: "2026-11-11",
      getReadyForDate: vi.fn(async () => staleDoc),
    })
    expect(res.status).toBe(404)
  })

  it("returns 404 for non-daily scopes such as weekly", async () => {
    const req = new NextRequest("http://localhost:3000/api/videos/latest?scope=weekly&category=all")
    const res = await handleLatestVideoRequest(req, {
      todayDateStr: "2026-11-11",
      getReadyForDate: vi.fn(async () => makeReadyVideo()),
    })
    expect(res.status).toBe(404)
  })

  it("returns 400 for unknown category or scope", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/videos/latest?scope=daily&category=bogus"
    )
    const res = await handleLatestVideoRequest(req, {
      todayDateStr: "2026-11-11",
      getReadyForDate: vi.fn(async () => null),
    })
    expect(res.status).toBe(400)
  })

  it("returns 200 public video metadata when today's ready video exists", async () => {
    const doc = makeReadyVideo()
    const req = new NextRequest("http://localhost:3000/api/videos/latest?scope=daily&category=all")
    const res = await handleLatestVideoRequest(req, {
      todayDateStr: "2026-11-11",
      getReadyForDate: vi.fn(async () => doc),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      video: { id: string; date: string; gcsVideoPath?: string }
    }
    expect(body.video.id).toBe(doc.id)
    expect(body.video.date).toBe("2026-11-11")
    expect(body.video.gcsVideoPath).toBeUndefined()
  })
})

describe("GET /api/videos/[id]/url", () => {
  it("returns 404 when video document is missing", async () => {
    const res = await handleVideoUrlRequest("daily__all__missing", {
      getById: vi.fn(async () => null),
      signObject: vi.fn(),
    })
    expect(res.status).toBe(404)
  })

  it("mints fresh signed videoUrl and posterUrl capped at <= 3600s", async () => {
    const doc = makeReadyVideo()
    const signObject = vi.fn(async (objectPath: string) => ({
      url: `https://storage.googleapis.com/signed/${objectPath}`,
      expiresAt: new Date("2026-11-11T10:00:00Z"),
    }))

    const res = await handleVideoUrlRequest(doc.id, {
      getById: vi.fn(async () => doc),
      signObject,
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      id: string
      videoUrl: string
      posterUrl: string
      expiresAt: string
      expiresInSeconds: number
    }
    expect(body.id).toBe(doc.id)
    expect(body.videoUrl).toContain("briefing.mp4")
    expect(body.posterUrl).toContain("poster.jpg")
    expect(body.expiresInSeconds).toBeLessThanOrEqual(3600)
    expect(signObject).toHaveBeenCalledTimes(2)
  })
})
