"use client"

import { useEffect, useState } from "react"
import { ExternalLink } from "lucide-react"
import type { Digest } from "@/lib/types"

interface DigestData extends Omit<Digest, "generatedAt"> {
  generatedAt: string
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours < 1) return "less than an hour ago"
  if (hours === 1) return "1 hour ago"
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? "1 day ago" : `${days} days ago`
}

export function DailyDigest() {
  const [digest, setDigest] = useState<DigestData | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading")

  useEffect(() => {
    fetch("/api/digest")
      .then((r) => {
        if (r.status === 404) return null
        if (!r.ok) throw new Error("fetch failed")
        return r.json() as Promise<DigestData>
      })
      .then((data) => {
        if (!data) {
          setStatus("empty")
          return
        }
        setDigest(data)
        setStatus("ready")
      })
      .catch(() => setStatus("error"))
  }, [])

  if (status === "loading") {
    return (
      <div className="border border-border p-5 space-y-3 animate-pulse">
        <div className="h-3 w-16 bg-muted rounded" />
        <div className="h-5 w-3/4 bg-muted rounded" />
        <div className="space-y-2 pt-1">
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-5/6 bg-muted rounded" />
          <div className="h-4 w-4/5 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (status === "empty" || status === "error" || !digest) return null

  return (
    <div className="border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          3-day digest
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {timeAgo(digest.generatedAt)}
        </span>
      </div>

      {digest.headline && (
        <p className="font-newsreader text-xl sm:text-2xl text-foreground leading-snug">
          {digest.headline}
        </p>
      )}

      {digest.insights.length > 0 && (
        <ul className="space-y-3.5 border-t border-border pt-4">
          {digest.insights.map((insight, i) => {
            const isGrounded = typeof insight === "object" && insight !== null && "text" in insight
            const text = isGrounded ? insight.text : insight
            const sources = isGrounded && Array.isArray(insight.sources) ? insight.sources : []

            return (
              <li key={i} className="flex gap-3">
                <span className="font-mono text-[10px] text-muted-foreground mt-1 shrink-0 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="space-y-1.5 flex-1">
                  <p className="font-newsreader text-base leading-snug text-muted-foreground">
                    {text}
                  </p>
                  {sources.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                        Sources:
                      </span>
                      {sources.map((src, sIdx) => (
                        <a
                          key={sIdx}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[10px] bg-muted/60 hover:bg-muted text-foreground px-2 py-0.5 rounded border border-border/60 transition-colors group"
                          title={src.title}
                        >
                          <span>{src.sourceName || src.domain || "Source"}</span>
                          <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
