"use client"

import { useEffect, useState } from "react"
import { ExternalLink } from "lucide-react"
import type { Digest, DigestScope, SourceCategory } from "@/lib/types"

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

const SCOPES: { id: DigestScope; label: string; tag: string }[] = [
  { id: "daily", label: "Daily", tag: "3-day digest" },
  { id: "weekly", label: "Weekly", tag: "Weekly digest" },
  { id: "monthly", label: "Monthly", tag: "Monthly digest" },
  { id: "overview", label: "Field Overview", tag: "State of AI overview" },
]

const CATEGORIES: { id: SourceCategory | "all"; label: string; icon: string }[] = [
  { id: "all", label: "State of AI", icon: "🌐" },
  { id: "ai-engineering", label: "AI Engineering", icon: "🛠️" },
  { id: "frontier-research", label: "Frontier R&D", icon: "🧪" },
  { id: "genmedia", label: "GenMedia", icon: "🎨" },
  { id: "ecosystem-analysis", label: "Ecosystem", icon: "📰" },
  { id: "industry-news", label: "Industry", icon: "🏢" },
]

interface DailyDigestProps {
  category?: SourceCategory | "all"
  onCategoryChange?: (category: SourceCategory | "all") => void
}

export function DailyDigest({ category = "all", onCategoryChange }: DailyDigestProps) {
  const [activeScope, setActiveScope] = useState<DigestScope>("daily")
  const [internalCategory, setInternalCategory] = useState<SourceCategory | "all">(category)
  const [digest, setDigest] = useState<DigestData | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading")

  const currentCategory = category ?? internalCategory

  useEffect(() => {
    let isCancelled = false

    const loadDigest = async () => {
      setStatus("loading")
      try {
        const r = await fetch(`/api/digest?scope=${activeScope}&category=${currentCategory}`)
        if (isCancelled) return
        if (r.status === 404) {
          setStatus("empty")
          setDigest(null)
          return
        }
        if (!r.ok) throw new Error("fetch failed")
        const data: DigestData = await r.json()
        if (isCancelled) return
        setDigest(data)
        setStatus("ready")
      } catch {
        if (isCancelled) return
        setStatus("error")
        setDigest(null)
      }
    }

    loadDigest()

    return () => {
      isCancelled = true
    }
  }, [activeScope, currentCategory])

  const currentScopeObj = SCOPES.find((s) => s.id === activeScope) ?? SCOPES[0]
  const currentCategoryObj = CATEGORIES.find((c) => c.id === currentCategory) ?? CATEGORIES[0]

  return (
    <div className="border border-border p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            {currentCategoryObj.icon} {currentCategoryObj.label} • {currentScopeObj.tag}
          </span>
          {digest?.generatedAt && (
            <span className="font-mono text-[10px] text-muted-foreground/70">
              • {timeAgo(digest.generatedAt)}
            </span>
          )}
        </div>

        {/* Scope Selector Tabs */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-md border border-border/60">
          {SCOPES.map((scope) => (
            <button
              key={scope.id}
              onClick={() => {
                setActiveScope(scope.id)
              }}
              className={`font-mono text-[10px] px-2.5 py-1 rounded transition-colors ${
                activeScope === scope.id
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {scope.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setInternalCategory(cat.id)
              onCategoryChange?.(cat.id)
            }}
            className={`font-mono text-[11px] px-3 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${
              currentCategory === cat.id
                ? "bg-primary text-primary-foreground font-medium border-primary"
                : "bg-muted/30 hover:bg-muted/60 text-muted-foreground border-border/60"
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {status === "loading" && (
        <div className="space-y-3 animate-pulse pt-2">
          <div className="h-5 w-3/4 bg-muted rounded" />
          <div className="space-y-2 pt-1">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-5/6 bg-muted rounded" />
            <div className="h-4 w-4/5 bg-muted rounded" />
          </div>
        </div>
      )}

      {status === "empty" && (
        <p className="font-mono text-xs text-muted-foreground italic pt-2">
          No {currentCategoryObj.label} digest for {currentScopeObj.label.toLowerCase()} available
          yet. Run ingestion to generate.
        </p>
      )}

      {status === "error" && (
        <p className="font-mono text-xs text-red-500 italic pt-2">
          Failed to load {currentCategoryObj.label} {currentScopeObj.label.toLowerCase()} digest.
        </p>
      )}

      {status === "ready" && digest && (
        <>
          {digest.headline && (
            <p className="font-newsreader text-xl sm:text-2xl text-foreground leading-snug">
              {digest.headline}
            </p>
          )}

          {digest.insights.length > 0 && (
            <ul className="space-y-3.5 border-t border-border pt-4">
              {digest.insights.map((insight, i) => {
                const isGrounded =
                  typeof insight === "object" && insight !== null && "text" in insight
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
        </>
      )}
    </div>
  )
}
