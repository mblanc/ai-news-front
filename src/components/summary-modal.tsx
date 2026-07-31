"use client"

import { useState, useEffect } from "react"
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

const SENTIMENT_CLASSES: Record<string, string> = {
  positive: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  negative: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  neutral: "bg-secondary text-muted-foreground border-border",
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="w-full sm:max-w-4xl max-h-[85vh] overflow-x-hidden overflow-y-auto p-6 sm:p-8 space-y-6 min-w-0"
      >
        <DialogHeader className="space-y-3 min-w-0">
          {/* Top badges & Date */}
          <div className="flex flex-wrap items-center justify-between gap-2 w-full min-w-0">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="border border-border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
                {TAG_LABELS[topicTag] ?? topicTag}
              </span>
              {sentiment && (
                <span
                  className={`border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest rounded-full shrink-0 ${
                    SENTIMENT_CLASSES[sentiment] ?? SENTIMENT_CLASSES.neutral
                  }`}
                >
                  {sentiment}
                </span>
              )}
              {cluster.importanceScore !== undefined && (
                <span className="border border-border bg-secondary/50 px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground shrink-0">
                  Impact: {cluster.importanceScore}/10
                </span>
              )}
            </div>
            <span className="font-mono text-xs text-muted-foreground shrink-0">
              {formatDateLong(cluster.publishedAt)}
            </span>
          </div>

          {/* Title */}
          <DialogTitle className="font-newsreader text-lg sm:text-xl leading-snug text-foreground text-left break-words min-w-0 pr-6">
            {leadArticle?.title ?? "Untitled Story"}
          </DialogTitle>

          {/* Sources List header */}
          <DialogDescription className="text-left font-sans text-xs text-muted-foreground flex flex-wrap items-center gap-2 pt-1 min-w-0 break-words">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground shrink-0">
              Coverage ({cluster.articles.length}):
            </span>
            <span className="flex flex-wrap items-center gap-1.5 min-w-0">
              {cluster.articles.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 bg-secondary border border-border/50 px-2 py-0.5 font-sans text-xs shrink-0 max-w-full truncate"
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
          <div className="flex items-center justify-center gap-2.5 p-4 bg-primary/5 border border-primary/20 rounded-md font-mono text-xs text-primary animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            <span>Analyzing article & generating AI Key Takeaways...</span>
          </div>
        )}

        {/* Entities tags */}
        {entities && entities.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 min-w-0">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mr-1 shrink-0">
              Key Entities:
            </span>
            {entities.map((ent, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="font-mono text-[11px] font-normal py-0.5 break-words max-w-full"
              >
                {ent}
              </Badge>
            ))}
          </div>
        )}

        {/* Executive Summary */}
        <div className="space-y-2 border-t border-border pt-4 min-w-0">
          <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
            Executive Summary
          </h4>
          <p className="font-newsreader text-base leading-snug text-foreground/90 bg-muted/20 p-4 border border-border/60 break-words whitespace-pre-wrap min-w-0">
            {summaryText}
          </p>
        </div>

        {/* Key Takeaways (if available) */}
        {takeaways.length > 0 && (
          <div className="space-y-2.5 pt-2 min-w-0">
            <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              Key Takeaways
            </h4>
            <ul className="space-y-2 font-sans text-sm text-foreground min-w-0">
              {takeaways.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 bg-card p-3 border border-border min-w-0"
                >
                  <span className="font-mono text-xs text-muted-foreground shrink-0 mt-1">•</span>
                  <span className="leading-normal break-words min-w-0 flex-1">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Why It Matters (if available) */}
        {whyItMatters && (
          <div className="space-y-1.5 pt-2 min-w-0">
            <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Why It Matters
            </h4>
            <p className="font-sans text-sm text-muted-foreground leading-snug bg-secondary/40 p-3.5 border border-border break-words min-w-0">
              {whyItMatters}
            </p>
          </div>
        )}

        {/* Source articles list */}
        <div className="border-t border-border pt-4 space-y-2.5 min-w-0">
          <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            All Source Articles ({cluster.articles.length})
          </h4>
          <div className="space-y-2 min-w-0">
            {cluster.articles.map((article) => (
              <div
                key={article.id}
                className="flex items-center justify-between gap-3 p-3 border border-border bg-card hover:bg-accent/40 transition-colors min-w-0"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <DomainIcon domain={article.domain} />
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-sm font-medium text-foreground truncate">
                      {article.title}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground truncate">
                      {article.sourceName || article.domain}
                    </p>
                  </div>
                </div>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-sans text-xs flex items-center gap-1.5 text-muted-foreground hover:text-foreground shrink-0 border border-border px-2.5 py-1.5 hover:bg-secondary transition-colors"
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
