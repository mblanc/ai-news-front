"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ExternalLink, CheckCircle2, FileText, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { DomainIcon } from "@/components/domain-icon"
import { formatDateLong } from "@/lib/format-date"
import type { Cluster } from "@/lib/types"
import { TOPIC_TAG_CLASSES, SENTIMENT_CONFIG, getImpactBadgeConfig } from "@/lib/color-tokens"

interface SummaryModalProps {
  cluster: Cluster | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TAG_LABELS: Record<string, string> = {
  "model-release": "Model release",
  research: "Research",
  funding: "Funding",
  product: "Product",
  policy: "Policy",
  industry: "Industry",
  agents: "Agents",
  hardware: "Hardware",
  opinion: "Opinion",
  education: "Education",
  other: "Other",
}

export function SummaryModal({ cluster, open, onOpenChange }: SummaryModalProps) {
  const [liveSummary, setLiveSummary] = useState<{
    summary?: string
    keyTakeaways?: string[]
    whyItMatters?: string
    topicTag?: string
    sentiment?: string
    entities?: string[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentClusterId, setCurrentClusterId] = useState<string | null>(null)

  if (cluster && cluster.id !== currentClusterId) {
    setCurrentClusterId(cluster.id)
    setLiveSummary(null)
    setLoading(false)
  }

  const hasTakeaways = cluster?.keyTakeaways && cluster.keyTakeaways.length > 0
  const hasWhy = cluster?.whyItMatters && cluster.whyItMatters.trim().length > 0
  const needsFetch = Boolean(open && cluster && !hasTakeaways && !hasWhy && !liveSummary)

  useEffect(() => {
    if (!needsFetch || !cluster) return

    let isMounted = true
    queueMicrotask(() => {
      if (isMounted) setLoading(true)
    })

    fetch(`/api/clusters/${cluster.id}/summarize`, { method: "POST" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (!isMounted) return
        setLiveSummary({
          summary: data.summary,
          keyTakeaways: data.keyTakeaways,
          whyItMatters: data.whyItMatters,
          topicTag: data.topicTag,
          sentiment: data.sentiment,
          entities: data.entities,
        })
      })
      .catch((err) => {
        console.error("Failed to generate on-demand summary:", err)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [needsFetch, cluster])

  const pushedHistoryRef = useRef(false)

  // 1. Synchronize story ID to URL when opened
  useEffect(() => {
    if (typeof window === "undefined") return

    if (open && cluster?.id) {
      const params = new URLSearchParams(window.location.search)
      if (params.get("story") !== cluster.id) {
        params.set("story", cluster.id)
        const qs = params.toString()
        const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
        window.history.pushState({ modal: "story", storyId: cluster.id }, "", newUrl)
        pushedHistoryRef.current = true
      }
    }
  }, [open, cluster?.id])

  // 2. Handle browser Back button: dismiss modal rather than leaving site
  useEffect(() => {
    if (!open || typeof window === "undefined") return

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      if (params.get("story") !== cluster?.id) {
        pushedHistoryRef.current = false
        onOpenChange(false)
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [open, cluster?.id, onOpenChange])

  // 3. Handle modal close from UI (X button, Escape key, backdrop click)
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen && typeof window !== "undefined") {
        if (pushedHistoryRef.current) {
          pushedHistoryRef.current = false
          window.history.back()
        } else {
          const params = new URLSearchParams(window.location.search)
          if (params.has("story")) {
            params.delete("story")
            const qs = params.toString()
            const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
            window.history.replaceState(window.history.state, "", newUrl)
          }
        }
      }
      onOpenChange(isOpen)
    },
    [onOpenChange]
  )

  if (!cluster) return null

  const leadArticle = cluster.articles[0]
  const summaryText =
    liveSummary?.summary || cluster.summary || leadArticle?.excerpt || "No summary available."
  const takeaways = liveSummary?.keyTakeaways ?? cluster.keyTakeaways ?? []
  const whyItMatters = liveSummary?.whyItMatters ?? cluster.whyItMatters ?? ""
  const entities = liveSummary?.entities ?? cluster.entities ?? []
  const topicTag = liveSummary?.topicTag ?? cluster.topicTag
  const sentiment = liveSummary?.sentiment ?? cluster.sentiment

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        className="w-full sm:max-w-3xl max-h-[85vh] overflow-x-hidden overflow-y-auto p-4 sm:p-5 space-y-4 min-w-0 rounded-2xl border border-border/80 bg-card shadow-2xl"
      >
        <DialogHeader className="space-y-2 min-w-0">
          {/* Top badges & Date (with right padding to prevent overlap with absolute close button) */}
          <div className="flex flex-wrap items-center justify-between gap-2 w-full min-w-0 pr-9 sm:pr-10">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span
                title={`Topic classification: ${TAG_LABELS[topicTag] ?? topicTag}`}
                className={`px-2.5 py-0.5 font-sans text-[11px] font-semibold rounded-full shrink-0 tracking-wide border ${
                  TOPIC_TAG_CLASSES[topicTag] ??
                  "bg-secondary text-secondary-foreground border-border/80"
                }`}
              >
                {TAG_LABELS[topicTag] ?? topicTag}
              </span>
              {sentiment &&
                (() => {
                  const sConf =
                    SENTIMENT_CONFIG[sentiment.toLowerCase()] ?? SENTIMENT_CONFIG.neutral
                  return (
                    <span
                      title={`Consensus sentiment: ${sentiment.toLowerCase()} tone across reporting`}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 font-sans text-[10px] uppercase tracking-wider font-semibold rounded-full shrink-0 border ${sConf.className}`}
                    >
                      <span className={`size-1.5 rounded-full shrink-0 ${sConf.dotColor}`} />
                      <span>{sentiment}</span>
                    </span>
                  )
                })()}
              {cluster.importanceScore !== undefined &&
                (() => {
                  const impact = getImpactBadgeConfig(cluster.importanceScore)
                  return (
                    <span
                      title={`Ecosystem impact: rated ${cluster.importanceScore}/10 based on architectural novelty, breakthrough potential, and enterprise relevance`}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] shrink-0 border cursor-help ${impact.className}`}
                    >
                      {impact.isHigh && <span className="text-amber-500 font-bold">★</span>}
                      <span>Impact: {cluster.importanceScore}/10</span>
                    </span>
                  )
                })()}
            </div>
            <time
              dateTime={
                cluster.publishedAt instanceof Date
                  ? cluster.publishedAt.toISOString()
                  : new Date(cluster.publishedAt).toISOString()
              }
              title={`Published on ${formatDateLong(cluster.publishedAt)}`}
              className="font-sans text-[11px] text-muted-foreground shrink-0 whitespace-nowrap"
            >
              {formatDateLong(cluster.publishedAt)}
            </time>
          </div>

          {/* Title */}
          <DialogTitle className="font-display text-lg sm:text-xl font-bold leading-tight tracking-tight text-foreground text-left break-words min-w-0 pr-8 sm:pr-10 text-balance">
            {leadArticle?.title ?? "Untitled Story"}
          </DialogTitle>

          {/* Sources List header */}
          <DialogDescription className="text-left font-sans text-xs text-muted-foreground flex flex-wrap items-center gap-1.5 pt-0.5 min-w-0 break-words">
            <span
              className="font-sans text-[11px] font-semibold text-foreground shrink-0"
              title="Independent news outlets and publications covering this story"
            >
              Coverage ({cluster.articles.length}):
            </span>
            <span className="flex flex-wrap items-center gap-1 min-w-0">
              {cluster.articles.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 bg-muted/70 border border-border/60 rounded-full px-2 py-0.5 font-sans text-[11px] shrink-0 max-w-full truncate"
                >
                  <DomainIcon domain={a.domain} />
                  <span className="truncate">{a.sourceName || a.domain}</span>
                </span>
              ))}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Loading Indicator for On-Demand Summary Generation */}
        {loading && (
          <div className="flex items-center justify-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl font-sans text-xs text-primary animate-pulse">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
            <span>Analyzing coverage & synthesizing AI insights…</span>
          </div>
        )}

        {/* Entities tags */}
        {entities && entities.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-0.5 min-w-0">
            <span
              className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mr-0.5 shrink-0"
              title="Key organizations, models, products, and individuals identified"
            >
              Entities:
            </span>
            {entities.map((ent, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="font-mono text-[10px] font-normal py-0 px-2 rounded-full break-words max-w-full"
              >
                {ent}
              </Badge>
            ))}
          </div>
        )}

        {/* Executive Summary */}
        <div className="space-y-1.5 border-t border-border/60 pt-3 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="font-display text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-primary shrink-0" />
              Executive Synthesis
            </h4>
            <span className="font-mono text-[10px] text-muted-foreground/80">
              Cross-source AI briefing
            </span>
          </div>
          <p className="font-sans text-xs sm:text-sm leading-normal text-foreground/90 bg-tertiary-container/20 p-3.5 rounded-xl border border-tertiary/20 break-words whitespace-pre-wrap min-w-0">
            {summaryText}
          </p>
        </div>

        {/* Key Takeaways (if available) */}
        {takeaways.length > 0 && (
          <div className="space-y-1.5 pt-1.5 min-w-0 animate-in fade-in slide-in-from-top-1 duration-200 ease-[cubic-bezier(0.05,0.7,0.1,1)]">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="font-display text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                Key Takeaways
              </h4>
              <span className="font-mono text-[10px] text-muted-foreground/80">
                Core facts & findings
              </span>
            </div>
            <ul className="space-y-1.5 font-sans text-xs text-foreground min-w-0">
              {takeaways.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 bg-background/80 p-2.5 rounded-lg border border-border/70 min-w-0 shadow-xs"
                >
                  <span className="font-mono text-xs text-primary font-bold shrink-0 mt-0.5">
                    •
                  </span>
                  <span className="leading-normal break-words min-w-0 flex-1">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Why It Matters (if available) */}
        {whyItMatters && (
          <div className="space-y-1 pt-1.5 min-w-0 animate-in fade-in slide-in-from-top-1 duration-200 ease-[cubic-bezier(0.05,0.7,0.1,1)]">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="font-display text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Why It Matters
              </h4>
              <span className="font-mono text-[10px] text-muted-foreground/80">
                Strategic ecosystem impact
              </span>
            </div>
            <p className="font-sans text-xs text-foreground/90 leading-normal bg-secondary/30 p-3 rounded-lg border border-secondary/40 break-words min-w-0">
              {whyItMatters}
            </p>
          </div>
        )}

        {/* Source articles list */}
        <div className="border-t border-border/60 pt-3 space-y-1.5 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="font-display text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              Original Sources ({cluster.articles.length})
            </h4>
            <span className="font-mono text-[10px] text-muted-foreground/80">
              Primary reporting
            </span>
          </div>
          <div className="space-y-1.5 min-w-0">
            {cluster.articles.map((article) => (
              <div
                key={article.id}
                className="flex items-center justify-between gap-2.5 p-2.5 rounded-lg border border-border/60 bg-background/60 hover:bg-muted/40 transition-colors min-w-0"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <DomainIcon domain={article.domain} />
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-xs font-semibold text-foreground truncate">
                      {article.title}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground truncate">
                      {article.sourceName || article.domain}
                    </p>
                  </div>
                </div>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Visit original article: "${article.title}" on ${article.sourceName || article.domain}`}
                  className="font-sans text-xs font-medium flex items-center gap-1 text-foreground hover:text-primary-foreground hover:bg-primary shrink-0 rounded-full border border-border/80 px-2.5 py-1 transition-all shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Visit <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
