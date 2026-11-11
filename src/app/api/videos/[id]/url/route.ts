import { type NextRequest, NextResponse } from "next/server"
import { getDigestVideoRepo } from "@/lib/video/repo"
import { createDefaultGcsObjectSigner, MAX_SIGNED_URL_TTL_SECONDS } from "@/lib/video/gcs-signer"
import type { VideoDocument } from "@/lib/video/types"

export interface VideoUrlDeps {
  getById?: (id: string) => Promise<VideoDocument | null>
  signObject?: (
    objectPath: string,
    expiresInSeconds?: number
  ) => Promise<{ url: string; expiresAt: Date }>
}

export async function handleVideoUrlRequest(id: string, deps: VideoUrlDeps = {}) {
  if (!id || id.length > 128) {
    return NextResponse.json({ error: "Invalid video id" }, { status: 400 })
  }

  try {
    const getById = deps.getById ?? ((videoId) => getDigestVideoRepo().getById(videoId))
    const doc = await getById(id)

    if (!doc || doc.status !== "ready") {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    const signObject = deps.signObject ?? createDefaultGcsObjectSigner()
    const [signedVideo, signedPoster] = await Promise.all([
      signObject(doc.gcsVideoPath, MAX_SIGNED_URL_TTL_SECONDS),
      signObject(doc.gcsPosterPath, MAX_SIGNED_URL_TTL_SECONDS),
    ])

    return NextResponse.json(
      {
        id: doc.id,
        videoUrl: signedVideo.url,
        posterUrl: signedPoster.url,
        expiresAt: signedVideo.expiresAt.toISOString(),
        expiresInSeconds: MAX_SIGNED_URL_TTL_SECONDS,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return handleVideoUrlRequest(id)
}
