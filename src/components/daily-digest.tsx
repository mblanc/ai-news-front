"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { ExternalLink, Clock, ArrowRight, RotateCcw, Sparkles } from "lucide-react"
import { DigestVideoPlayer } from "@/components/digest-video-player"
import type { Digest, DigestScope, SourceCategory } from "@/lib/types"

interface DigestData extends Omit<Digest, "generatedAt"> {
  generatedAt: string
}

export interface DigestManifestEntry {
  docId?: string
  scope: DigestScope
  category: SourceCategory | "all"
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

export function getNextScheduleInfo(scope: DigestScope): {
  countdown: string
  scheduleDesc: string
  nextDateLong: string
} {
  const now = new Date()

  if (scope === "weekly" || scope === "overview") {
    // Next Monday at 08:00 Europe/Paris (UTC+2 in summer, UTC+1 in winter; approximate at UTC 07:00)
    const nextMonday = new Date(now)
    const day = now.getUTCDay()
    const diffDays = (8 - day) % 7 || 7
    nextMonday.setUTCDate(now.getUTCDate() + diffDays)
    nextMonday.setUTCHours(7, 0, 0, 0)
    if (nextMonday.getTime() <= now.getTime()) {
      nextMonday.setUTCDate(nextMonday.getUTCDate() + 7)
    }
    const diffMs = Math.max(0, nextMonday.getTime() - now.getTime())
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const days = Math.floor(diffHours / 24)
    const hours = diffHours % 24
    const countdown = days > 0 ? `${days}d ${hours}h` : `${hours}h`

    return {
      countdown,
      scheduleDesc: "Every Monday at 08:00 CEST",
      nextDateLong:
        nextMonday.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }) + " at 08:00",
    }
  }

  if (scope === "monthly") {
    // 1st of next month at 08:00
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 7, 0, 0))
    const diffMs = Math.max(0, nextMonth.getTime() - now.getTime())
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    return {
      countdown: `${days} days`,
      scheduleDesc: "1st of every month at 08:00 CEST",
      nextDateLong:
        nextMonth.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }) + " at 08:00",
    }
  }

  // Daily
  const nextDaily = new Date(now)
  nextDaily.setUTCHours(7, 0, 0, 0)
  if (nextDaily.getTime() <= now.getTime()) {
    nextDaily.setUTCDate(nextDaily.getUTCDate() + 1)
  }
  const diffHours = Math.max(
    1,
    Math.floor((nextDaily.getTime() - now.getTime()) / (1000 * 60 * 60))
  )

  return {
    countdown: `${diffHours}h`,
    scheduleDesc: "Daily at 09:00 CEST (and hourly runs)",
    nextDateLong: "Tomorrow at 09:00",
  }
}

const SCOPE_DESCRIPTIONS: Record<DigestScope, string> = {
  daily: "Aggregates breaking models, papers, and product drops from the last 72 hours.",
  weekly:
    "Synthesizes multi-day cluster evolutions and strategic industry milestones from the past 7 days.",
  monthly:
    "Delivers macro-level industry trends, compute architecture shifts, and benchmark breakthroughs.",
  overview: "Maintains a comprehensive state-of-the-art overview synthesizing frontier progress.",
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

export function DailyDigest({ category = "all" }: DailyDigestProps) {
  const [activeScope, setActiveScope] = useState<DigestScope>("daily")
  const [digest, setDigest] = useState<DigestData | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading")
  const [manifest, setManifest] = useState<DigestManifestEntry[]>([])
  const [manifestLoaded, setManifestLoaded] = useState(false)

  const currentCategory = category

  // 1. Pre-query available digest manifests on load
  useEffect(() => {
    let isCancelled = false

    fetch("/api/digest?manifest=true")
      .then((r) => (r.ok ? r.json() : { manifest: [] }))
      .then((data) => {
        if (isCancelled) return
        if (Array.isArray(data.manifest)) {
          setManifest(data.manifest)
        }
        setManifestLoaded(true)
      })
      .catch(() => {
        if (!isCancelled) setManifestLoaded(true)
      })

    return () => {
      isCancelled = true
    }
  }, [])

  // 2. Derive populated scopes for active category
  const populatedScopes = useMemo(() => {
    if (!manifestLoaded || manifest.length === 0) return null
    const scopes = new Set<DigestScope>()
    for (const m of manifest) {
      if (m.category === currentCategory) {
        scopes.add(m.scope)
      }
    }
    return scopes
  }, [manifest, manifestLoaded, currentCategory])

  const [reloadKey, setReloadKey] = useState(0)

  const handleScopeChange = (nextScope: DigestScope) => {
    if (nextScope !== activeScope) {
      setStatus("loading")
      setActiveScope(nextScope)
    }
  }

  const handleRefresh = useCallback(() => {
    setStatus("loading")
    setReloadKey((k) => k + 1)
  }, [])

  // 3. Load active digest data
  useEffect(() => {
    let isCancelled = false

    const fetchDigest = async () => {
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

    fetchDigest()

    return () => {
      isCancelled = true
    }
  }, [activeScope, currentCategory, reloadKey])

  const currentScopeObj = SCOPES.find((s) => s.id === activeScope) ?? SCOPES[0]
  const currentCategoryObj = CATEGORIES.find((c) => c.id === currentCategory) ?? CATEGORIES[0]
  const scheduleInfo = getNextScheduleInfo(activeScope)

  return (
    <div className="rounded-xl border border-tertiary/25 bg-gradient-to-b from-tertiary-container/15 via-card to-card p-3.5 sm:p-4 shadow-xs space-y-3 transition-all relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-container text-on-tertiary-container px-2.5 py-0.5 font-sans text-[11px] font-semibold tracking-wide border border-tertiary/30 shadow-xs">
            <span>{currentCategoryObj.icon}</span>
            <span>{currentCategoryObj.label}</span>
            <span className="opacity-60">•</span>
            <span>{currentScopeObj.tag}</span>
          </span>
          {digest?.generatedAt && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {timeAgo(digest.generatedAt)}
            </span>
          )}
        </div>

        {/* Scope Selector Tabs with Populated / Pending Badges */}
        <div
          role="tablist"
          aria-label="Digest time scope"
          className="flex flex-wrap items-center gap-0.5 bg-muted/70 p-0.5 rounded-full border border-border/60"
        >
          {SCOPES.map((scope) => {
            const isSelected = activeScope === scope.id
            const isPopulated = populatedScopes === null || populatedScopes.has(scope.id)
            const scopeSchedule = getNextScheduleInfo(scope.id)

            return (
              <button
                key={scope.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleScopeChange(scope.id)}
                title={
                  isPopulated
                    ? `View ${scope.label} digest`
                    : `${scope.label} digest pending. Schedule: ${scopeSchedule.scheduleDesc} (in ~${scopeSchedule.countdown})`
                }
                className={`group font-sans text-xs sm:text-[11px] px-3 py-1 sm:px-2.5 sm:py-0.5 rounded-full transition-all duration-120 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.97] cursor-pointer min-h-[30px] sm:min-h-0 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 ${
                  isSelected
                    ? "bg-background text-foreground font-semibold shadow-xs"
                    : isPopulated
                      ? "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      : "text-muted-foreground/75 hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <span>{scope.label}</span>
                {!isPopulated && (
                  <span
                    className="size-1.5 rounded-full bg-amber-500/80 shrink-0 group-hover:scale-125 transition-transform"
                    aria-label="Synthesis pending"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {status === "loading" && (
        <div className="space-y-2 animate-pulse pt-2">
          <div className="h-5 w-3/4 bg-muted rounded-md" />
          <div className="space-y-1.5 pt-1">
            <div className="h-3.5 w-full bg-muted rounded-md" />
            <div className="h-3.5 w-5/6 bg-muted rounded-md" />
          </div>
        </div>
      )}

      {status === "empty" && (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 sm:p-5 text-left space-y-3.5 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                <Clock className="h-3 w-3 shrink-0" />
                <span>Synthesis Pending</span>
              </span>
              <span className="font-mono text-xs font-medium text-muted-foreground">
                In ~{scheduleInfo.countdown}
              </span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground/80">
              {scheduleInfo.nextDateLong}
            </span>
          </div>

          <div className="space-y-1">
            <h4 className="font-display text-sm sm:text-base font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span>
                {currentCategoryObj.label} {currentScopeObj.label} Intelligence Briefing
              </span>
            </h4>
            <p className="font-sans text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
              {SCOPE_DESCRIPTIONS[activeScope]} Automated cross-source clustering will synthesize
              this issue on schedule ({scheduleInfo.scheduleDesc}).
            </p>
          </div>

          <div className="pt-2 border-t border-border/50 flex flex-wrap items-center gap-2.5">
            {activeScope !== "daily" && (
              <button
                type="button"
                onClick={() => handleScopeChange("daily")}
                className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full transition-all shadow-xs cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span>Read Active Daily Digest</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 font-sans text-xs text-muted-foreground hover:text-foreground bg-card hover:bg-muted border border-border/70 px-3 py-1.5 rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Check again</span>
            </button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl bg-destructive/5 border border-destructive/25 p-3.5 text-center flex items-center justify-between gap-3">
          <p className="font-sans text-xs text-destructive text-left">
            Failed to fetch {currentCategoryObj.label} {currentScopeObj.label.toLowerCase()} digest.
            Please verify your connection.
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-1 font-sans text-xs font-semibold text-foreground bg-card hover:bg-muted border border-border px-3 py-1 rounded-full transition-colors shrink-0 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {status === "ready" && digest && (
        <div className="space-y-3 pt-0.5 animate-in fade-in slide-in-from-top-1 duration-200 ease-[cubic-bezier(0.05,0.7,0.1,1)]">
          {digest.headline && (
            <h3 className="font-display text-base sm:text-lg font-bold text-foreground leading-snug tracking-tight text-balance">
              {digest.headline}
            </h3>
          )}

          <DigestVideoPlayer
            key={`${activeScope}-${currentCategory}`}
            scope={activeScope}
            category={currentCategory}
          />

          {digest.insights.length > 0 && (
            <ul className="space-y-2.5 border-t border-border/60 pt-2.5">
              {digest.insights.map((insight, i) => {
                const isGrounded =
                  typeof insight === "object" && insight !== null && "text" in insight
                const text = isGrounded ? insight.text : insight
                const sources = isGrounded && Array.isArray(insight.sources) ? insight.sources : []

                return (
                  <li key={i} className="flex gap-2.5 items-start">
                    <span className="font-mono text-[10px] font-semibold text-primary bg-primary/10 rounded-full h-5 w-5 flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="font-sans text-xs sm:text-sm leading-normal text-foreground/90">
                        {text}
                      </p>
                      {sources.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                            Sources:
                          </span>
                          {sources.map((src, sIdx) => (
                            <a
                              key={sIdx}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[10px] bg-muted/80 hover:bg-muted text-foreground px-2 py-0.5 rounded-full border border-border/60 transition-colors group"
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
      )}
    </div>
  )
}
