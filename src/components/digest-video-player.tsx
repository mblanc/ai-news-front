"use client"

import { useEffect, useState, useCallback } from "react"
import { Play, ChevronUp, Loader2, Video } from "lucide-react"
import type { DigestScope, SourceCategory } from "@/lib/types"
import type { PublicVideoMetadata } from "@/app/api/videos/latest/route"

interface SignedUrlsState {
  videoUrl: string
  posterUrl: string
  expiresAt: string
}

interface DigestVideoPlayerProps {
  scope: DigestScope
  category: SourceCategory | "all"
}

function formatDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds))
  const mins = Math.floor(rounded / 60)
  const secs = rounded % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function DigestVideoPlayer({ scope, category }: DigestVideoPlayerProps) {
  const [video, setVideo] = useState<PublicVideoMetadata | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [signedUrls, setSignedUrls] = useState<SignedUrlsState | null>(null)
  const [loadingUrls, setLoadingUrls] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

  const loadSignedUrls = useCallback(async (videoId: string, signal?: AbortSignal) => {
    setLoadingUrls(true)
    setUrlError(null)
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}/url`, { signal })
      if (!res.ok) {
        throw new Error(`Could not mint playback URL (${res.status})`)
      }
      const data = (await res.json()) as SignedUrlsState
      if (!signal?.aborted) {
        setSignedUrls(data)
      }
    } catch (err) {
      if (!signal?.aborted) {
        setUrlError(err instanceof Error ? err.message : "Playback URL error")
      }
    } finally {
      if (!signal?.aborted) {
        setLoadingUrls(false)
      }
    }
  }, [])

  useEffect(() => {
    if (scope !== "daily" || category !== "all") return
    const controller = new AbortController()

    fetch(
      `/api/videos/latest?scope=${encodeURIComponent(scope)}&category=${encodeURIComponent(category)}`,
      { signal: controller.signal }
    )
      .then((res) => (res.ok ? (res.json() as Promise<{ video?: PublicVideoMetadata }>) : null))
      .then((data) => {
        if (!controller.signal.aborted && data?.video) {
          setVideo(data.video)
          void loadSignedUrls(data.video.id, controller.signal)
        }
      })
      .catch(() => {
        // Ignore aborts and network unavailability; cartouche simply omits unavailable videos.
      })

    return () => controller.abort()
  }, [scope, category, loadSignedUrls])

  const handleToggle = useCallback(() => {
    if (!video) return
    const next = !expanded
    setExpanded(next)
    if (next) {
      const expiresSoon = signedUrls && Date.parse(signedUrls.expiresAt) - Date.now() < 60_000
      if (!signedUrls || expiresSoon) {
        void loadSignedUrls(video.id)
      }
    }
  }, [video, expanded, signedUrls, loadSignedUrls])

  if (!video) return null

  return (
    <div
      data-testid="digest-video-cartouche"
      className="rounded-xl border border-border/75 bg-muted/35 p-3 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1 font-sans text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                <span>Hide Video Briefing</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 shrink-0 fill-current" />
                <span>Watch Briefing</span>
              </>
            )}
          </button>

          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-foreground/85 bg-card border border-border/70 px-2 py-0.5 rounded-full">
            <Video className="h-3 w-3 text-primary shrink-0" />
            <span>{formatDuration(video.durationSec)}</span>
          </span>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2.5">
          {loadingUrls && (
            <div className="aspect-video w-full rounded-lg border border-border/60 bg-muted flex items-center justify-center gap-2 text-xs font-sans text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Preparing signed playback stream…</span>
            </div>
          )}

          {urlError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-center justify-between gap-3">
              <p className="font-sans text-xs text-destructive">{urlError}</p>
              <button
                type="button"
                onClick={() => void loadSignedUrls(video.id)}
                className="font-sans text-xs font-semibold px-3 py-1 rounded-full border border-border bg-card hover:bg-muted cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {!loadingUrls && !urlError && signedUrls && (
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-border/80 bg-black shadow-xs">
              <video
                key={signedUrls.videoUrl}
                controls
                playsInline
                preload="metadata"
                poster={signedUrls.posterUrl}
                src={signedUrls.videoUrl}
                className="h-full w-full object-contain"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
