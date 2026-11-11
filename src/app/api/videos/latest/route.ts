import { type NextRequest, NextResponse } from "next/server"
import { getDigestVideoRepo } from "@/lib/video/repo"
import { VIDEO_CATEGORIES, type VideoCategory, type VideoDocument } from "@/lib/video/types"
import type { DigestScope } from "@/lib/types"

const VALID_SCOPES: ReadonlySet<DigestScope> = new Set(["daily", "weekly", "monthly", "overview"])
const VALID_CATEGORIES: ReadonlySet<string> = new Set(VIDEO_CATEGORIES)

export interface PublicVideoMetadata {
  id: string
  digestId: DigestScope
  category: VideoCategory
  date: string
  headline: string
  insightCount: number
  durationSec: number
  lufs: number
  criticVerdict: VideoDocument["criticVerdict"]
  criticNotes: string
  criticRounds: number
  feedbackCount: number
  upVotes: number
  downVotes: number
  generatedAt: string
}

export function toPublicVideoMetadata(doc: VideoDocument): PublicVideoMetadata {
  const entries = doc.humanFeedback ?? []
  const upVotes = entries.filter((item) => item.rating === "up").length
  const downVotes = entries.filter((item) => item.rating === "down").length

  return {
    id: doc.id,
    digestId: doc.digestId,
    category: doc.category,
    date: doc.date,
    headline: doc.headline,
    insightCount: doc.insightCount,
    durationSec: doc.durationSec,
    lufs: doc.lufs,
    criticVerdict: doc.criticVerdict,
    criticNotes: doc.criticNotes,
    criticRounds: doc.criticRounds,
    feedbackCount: entries.length,
    upVotes,
    downVotes,
    generatedAt: doc.generatedAt,
  }
}

export interface LatestVideoDeps {
  getLatestReady?: (digestId: DigestScope, category: VideoCategory) => Promise<VideoDocument | null>
}

export async function handleLatestVideoRequest(req: NextRequest, deps: LatestVideoDeps = {}) {
  const scopeRaw = req.nextUrl.searchParams.get("scope") || "daily"
  const categoryRaw = req.nextUrl.searchParams.get("category") || "all"

  if (!VALID_SCOPES.has(scopeRaw as DigestScope)) {
    return NextResponse.json({ error: `Invalid scope: ${scopeRaw}` }, { status: 400 })
  }
  if (!VALID_CATEGORIES.has(categoryRaw)) {
    return NextResponse.json({ error: `Invalid category: ${categoryRaw}` }, { status: 400 })
  }

  try {
    const getLatestReady =
      deps.getLatestReady ??
      ((scope, category) => getDigestVideoRepo().getLatestReady(scope, category))
    const doc = await getLatestReady(scopeRaw as DigestScope, categoryRaw as VideoCategory)

    if (!doc) {
      return NextResponse.json({ error: "No ready video found" }, { status: 404 })
    }

    return NextResponse.json(
      { video: toPublicVideoMetadata(doc) },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleLatestVideoRequest(req)
}
