import { describe, it, expect, vi } from "vitest"
import { NextRequest } from "next/server"
import { handleVideoFeedbackRequest } from "@/app/api/videos/[id]/feedback/route"
import type { VideoDocument } from "@/lib/video/types"

const READY_DOC: VideoDocument = {
  id: "2026-11-11_daily_all",
  date: "2026-11-11",
  digestId: "daily",
  category: "all",
  status: "ready",
  gcsVideoPath: "videos/2026-11-11/daily/all/briefing.mp4",
  gcsPosterPath: "videos/2026-11-11/daily/all/poster.jpg",
  durationSec: 84,
  lufs: -16.2,
  generatedAt: "2026-11-11T08:05:00Z",
  headline: "Daily Headline",
  insightCount: 4,
  criticVerdict: "OURS WINS",
  criticRounds: 2,
  criticNotes: "Looks sharp.",
}

describe("POST /api/videos/[id]/feedback", () => {
  it("returns 400 when rating is invalid", async () => {
    const req = new NextRequest("http://localhost:3000/api/videos/2026-11-11_daily_all/feedback", {
      method: "POST",
      body: JSON.stringify({ rating: "meh" }),
    })

    const res = await handleVideoFeedbackRequest(req, "2026-11-11_daily_all", {
      getById: vi.fn(async () => READY_DOC),
      addFeedback: vi.fn(),
    })

    expect(res.status).toBe(400)
  })

  it("returns 400 when note exceeds 1000 characters", async () => {
    const req = new NextRequest("http://localhost:3000/api/videos/2026-11-11_daily_all/feedback", {
      method: "POST",
      body: JSON.stringify({ rating: "down", note: "a".repeat(1001) }),
    })

    const res = await handleVideoFeedbackRequest(req, "2026-11-11_daily_all", {
      getById: vi.fn(async () => READY_DOC),
      addFeedback: vi.fn(),
    })

    expect(res.status).toBe(400)
  })

  it("returns 404 when video does not exist", async () => {
    const req = new NextRequest("http://localhost:3000/api/videos/missing/feedback", {
      method: "POST",
      body: JSON.stringify({ rating: "up" }),
    })

    const res = await handleVideoFeedbackRequest(req, "missing", {
      getById: vi.fn(async () => null),
      addFeedback: vi.fn(),
    })

    expect(res.status).toBe(404)
  })

  it("persists feedback entry with optional IAP attribution and returns 200", async () => {
    const addFeedback = vi.fn(async (_id, feedback) => ({
      rating: feedback.rating,
      note: feedback.note,
      updatedBy: feedback.updatedBy,
      updatedAt: "2026-11-11T09:15:00Z",
    }))
    const req = new NextRequest("http://localhost:3000/api/videos/2026-11-11_daily_all/feedback", {
      method: "POST",
      headers: {
        "x-goog-authenticated-user-email": "accounts.google.com:Reviewer@Google.com",
      },
      body: JSON.stringify({ rating: "up", note: "  Great chart legibility  " }),
    })

    const res = await handleVideoFeedbackRequest(req, "2026-11-11_daily_all", {
      getById: vi.fn(async () => READY_DOC),
      addFeedback,
    })

    expect(res.status).toBe(200)
    expect(addFeedback).toHaveBeenCalledWith("2026-11-11_daily_all", {
      rating: "up",
      note: "Great chart legibility",
      updatedBy: "reviewer@google.com",
    })
    const body = (await res.json()) as { ok: boolean; entry: { rating: string; note?: string } }
    expect(body.ok).toBe(true)
    expect(body.entry.rating).toBe("up")
  })
})
