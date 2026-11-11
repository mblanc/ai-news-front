import { type NextRequest, NextResponse } from "next/server"
import { getDigestVideoRepo } from "@/lib/video/repo"
import {
  VIDEO_CATEGORIES,
  getParisDateString,
  type VideoCategory,
  type VideoDocument,
} from "@/lib/video/types"
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
  costUsd?: number
  generatedAt: string
}

export function toPublicVideoMetadata(doc: VideoDocument): PublicVideoMetadata {
  return {
    id: doc.id,
    digestId: doc.digestId,
    category: doc.category,
    date: doc.date,
    headline: doc.headline,
    insightCount: doc.insightCount,
    durationSec: doc.durationSec,
    lufs: doc.lufs,
    ...(doc.cost ? { costUsd: doc.cost.totalUsd } : {}),
    generatedAt: doc.generatedAt,
  }
}

export interface LatestVideoDeps {
  todayDateStr?: string
  getReadyForDate?: (
    date: string,
    digestId: DigestScope,
    category: VideoCategory
  ) => Promise<VideoDocument | null>
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

  // Videos are strictly daily briefings; never display non-daily scopes or stale prior-day videos.
  if (scopeRaw !== "daily") {
    return NextResponse.json({ error: "No video available for scope" }, { status: 404 })
  }

  try {
    const today = deps.todayDateStr ?? getParisDateString()
    const getReadyForDate =
      deps.getReadyForDate ??
      ((date, scope, category) => getDigestVideoRepo().getReadyForDate(date, scope, category))
    const doc = await getReadyForDate(today, "daily", categoryRaw as VideoCategory)

    if (!doc || doc.date !== today) {
      return NextResponse.json({ error: "No ready video found for today" }, { status: 404 })
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
