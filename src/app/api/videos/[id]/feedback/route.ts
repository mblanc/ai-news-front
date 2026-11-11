import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { extractEmailFromIapHeader } from "@/lib/auth"
import { getDigestVideoRepo } from "@/lib/video/repo"
import type { FeedbackEntry, FeedbackRating, VideoDocument } from "@/lib/video/types"

const FeedbackBodySchema = z.object({
  rating: z.enum(["up", "down"]),
  note: z.string().trim().max(1000).optional(),
})

export interface VideoFeedbackDeps {
  getById?: (id: string) => Promise<VideoDocument | null>
  addFeedback?: (
    id: string,
    feedback: { rating: FeedbackRating; note?: string; updatedBy?: string }
  ) => Promise<FeedbackEntry>
}

export async function handleVideoFeedbackRequest(
  req: NextRequest,
  id: string,
  deps: VideoFeedbackDeps = {}
) {
  if (!id || id.length > 128) {
    return NextResponse.json({ error: "Invalid video id" }, { status: 400 })
  }

  let parsedBody: z.infer<typeof FeedbackBodySchema>
  try {
    const raw = await req.json()
    const result = FeedbackBodySchema.safeParse(raw)
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid feedback payload", details: result.error.flatten() },
        { status: 400 }
      )
    }
    parsedBody = result.data
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    const repo = getDigestVideoRepo()
    const getById = deps.getById ?? ((videoId) => repo.getById(videoId))
    const doc = await getById(id)

    if (!doc || doc.status !== "ready") {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    const updatedBy =
      extractEmailFromIapHeader(req.headers.get("x-goog-authenticated-user-email")) ?? undefined
    const cleanNote = parsedBody.note ? parsedBody.note : undefined
    const addFeedback =
      deps.addFeedback ?? ((videoId, feedback) => repo.addFeedback(videoId, feedback))

    const entry = await addFeedback(id, {
      rating: parsedBody.rating,
      ...(cleanNote ? { note: cleanNote } : {}),
      ...(updatedBy ? { updatedBy } : {}),
    })

    return NextResponse.json({ ok: true, entry })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return handleVideoFeedbackRequest(req, id)
}
