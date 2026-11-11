"use client"

import { useEffect, useState, useCallback, type FormEvent } from "react"
import {
  Play,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Send,
  Video,
} from "lucide-react"
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
  const [expanded, setExpanded] = useState(false)
  const [signedUrls, setSignedUrls] = useState<SignedUrlsState | null>(null)
  const [loadingUrls, setLoadingUrls] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

  const [selectedRating, setSelectedRating] = useState<"up" | "down" | null>(null)
  const [note, setNote] = useState("")
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [feedbackSaved, setFeedbackSaved] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    fetch(
      `/api/videos/latest?scope=${encodeURIComponent(scope)}&category=${encodeURIComponent(category)}`,
      { signal: controller.signal }
    )
      .then((res) => (res.ok ? (res.json() as Promise<{ video?: PublicVideoMetadata }>) : null))
      .then((data) => {
        if (!controller.signal.aborted && data?.video) {
          setVideo(data.video)
        }
      })
      .catch(() => {
        // Ignore aborts and network unavailability; cartouche simply omits unavailable videos.
      })

    return () => controller.abort()
  }, [scope, category])

  const loadSignedUrls = useCallback(async (videoId: string) => {
    setLoadingUrls(true)
    setUrlError(null)
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}/url`)
      if (!res.ok) {
        throw new Error(`Could not mint playback URL (${res.status})`)
      }
      const data = (await res.json()) as SignedUrlsState
      setSignedUrls(data)
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : "Playback URL error")
    } finally {
      setLoadingUrls(false)
    }
  }, [])

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

  const submitFeedback = async (rating: "up" | "down", submittedNote?: string) => {
    if (!video || submittingFeedback) return
    setSubmittingFeedback(true)
    setFeedbackError(null)
    setFeedbackSaved(false)
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(video.id)}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          ...(submittedNote?.trim() ? { note: submittedNote.trim() } : {}),
        }),
      })
      if (!res.ok) {
        throw new Error(`Feedback request failed (${res.status})`)
      }
      setVideo((prev) =>
        prev
          ? {
              ...prev,
              feedbackCount: prev.feedbackCount + 1,
              upVotes: prev.upVotes + (rating === "up" ? 1 : 0),
              downVotes: prev.downVotes + (rating === "down" ? 1 : 0),
            }
          : prev
      )
      setNote("")
      setFeedbackSaved(true)
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : "Could not save feedback")
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const handleRatingClick = (rating: "up" | "down") => {
    setSelectedRating(rating)
    if (!note.trim()) {
      void submitFeedback(rating)
    }
  }

  const handleNoteSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!selectedRating) return
    void submitFeedback(selectedRating, note)
  }

  if (!video) return null

  const isApproved = video.criticVerdict === "OURS WINS"

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

          <span
            title={video.criticNotes || undefined}
            className={
              isApproved
                ? "inline-flex items-center gap-1 font-mono text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25"
                : "inline-flex items-center gap-1 font-mono text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/12 text-amber-800 dark:text-amber-300 border border-amber-500/30"
            }
          >
            {isApproved ? (
              <CheckCircle2 className="h-3 w-3 shrink-0" />
            ) : (
              <AlertCircle className="h-3 w-3 shrink-0" />
            )}
            <span>{isApproved ? "Quality Verified" : "Published · Needs Review"}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleRatingClick("up")}
            disabled={submittingFeedback}
            aria-label="Thumbs up video briefing"
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] transition-colors cursor-pointer ${
              selectedRating === "up"
                ? "bg-primary/15 border-primary/50 text-primary"
                : "bg-card border-border/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            <ThumbsUp className="h-3 w-3" />
            <span>{video.upVotes}</span>
          </button>
          <button
            type="button"
            onClick={() => handleRatingClick("down")}
            disabled={submittingFeedback}
            aria-label="Thumbs down video briefing"
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] transition-colors cursor-pointer ${
              selectedRating === "down"
                ? "bg-destructive/15 border-destructive/50 text-destructive"
                : "bg-card border-border/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            <ThumbsDown className="h-3 w-3" />
            <span>{video.downVotes}</span>
          </button>
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

          {video.criticNotes && (
            <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
              Critic ({video.criticRounds} rounds): {video.criticNotes}
            </p>
          )}

          <form onSubmit={handleNoteSubmit} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              placeholder="Optional editorial feedback on pacing, visuals, or factual clarity…"
              className="flex-1 min-w-[200px] rounded-full border border-border bg-background px-3 py-1.5 font-sans text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={!selectedRating || !note.trim() || submittingFeedback}
              className="inline-flex items-center gap-1 rounded-full bg-card hover:bg-muted disabled:opacity-50 border border-border px-3 py-1.5 font-sans text-xs font-medium text-foreground transition-colors cursor-pointer"
            >
              <Send className="h-3 w-3" />
              <span>Send note</span>
            </button>
            {feedbackSaved && (
              <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
                Saved
              </span>
            )}
            {feedbackError && (
              <span className="font-mono text-[11px] text-destructive">{feedbackError}</span>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
