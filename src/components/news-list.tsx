"use client"

import { useMemo, useState, useEffect, useCallback, memo } from "react"
import dynamic from "next/dynamic"
import { ExternalLink, FileText, RotateCcw } from "lucide-react"
import { DomainIcon } from "@/components/domain-icon"
import { formatDate, formatDateLong } from "@/lib/format-date"
import type { Cluster } from "@/lib/types"
import type { FilterOptions } from "@/components/filter-panel"
import { TOPIC_TAG_CLASSES, SENTIMENT_CONFIG } from "@/lib/color-tokens"

const SummaryModal = dynamic(
  () => import("@/components/summary-modal").then((m) => m.SummaryModal),
  { ssr: false }
)

interface NewsListProps {
  clusters: Cluster[]
  filters: FilterOptions
  searchQuery?: string
  onResetFilters?: () => void
  selectedCluster?: Cluster | null
  onSelectCluster?: (cluster: Cluster | null) => void
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

const ClusterCard = memo(function ClusterCard({
  cluster,
  isFocused = false,
  onOpenSummary,
}: {
  cluster: Cluster
  isFocused?: boolean
  onOpenSummary: (cluster: Cluster) => void
}) {
  const uniqueArticles = useMemo(() => {
    const seen = new Set<string>()
    return cluster.articles.filter((a) => {
      if (!a.id) return true
      if (seen.has(a.id)) return false
      seen.add(a.id)
      return true
    })
  }, [cluster.articles])

  const lead = uniqueArticles[0]
  const leadTitle = lead?.title ?? "Untitled"
  const summaryText = cluster.summary || lead?.excerpt

  const topicTagClass =
    TOPIC_TAG_CLASSES[cluster.topicTag] ?? "bg-secondary text-secondary-foreground border-border/80"

  const sentimentKey = cluster.sentiment?.toLowerCase() ?? ""
  const sentimentConfig = SENTIMENT_CONFIG[sentimentKey] ?? SENTIMENT_CONFIG.neutral

  return (
    <article
      id={`cluster-card-${cluster.id}`}
      tabIndex={-1}
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 140px" }}
      className={`group relative rounded-xl border p-3.5 sm:p-4 transition-all duration-200 ease-out outline-none focus-visible:outline-none ${
        isFocused
          ? "border-primary ring-2 ring-primary/60 bg-surface-container-low shadow-md"
          : "border-border/70 bg-card shadow-xs hover:shadow-md hover:border-primary/40"
      }`}
    >
      {/* Calm Header Row: Topic Badge & Date (Left), Primary Source Link (Right) */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {isFocused && (
            <span
              title="Currently selected story for keyboard navigation (J/K)"
              className="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold tracking-wide bg-primary/15 text-primary border border-primary/25 animate-in fade-in"
            >
              Active
            </span>
          )}
          <span
            title={`Topic category: ${TAG_LABELS[cluster.topicTag] ?? cluster.topicTag}`}
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-sans text-[11px] font-medium tracking-wide border ${topicTagClass}`}
          >
            {TAG_LABELS[cluster.topicTag] ?? cluster.topicTag}
          </span>
          <span
            title={`Published ${formatDateLong(cluster.publishedAt)}`}
            className="font-sans text-xs text-muted-foreground"
          >
            {formatDate(cluster.publishedAt)}
          </span>
        </div>

        {/* Direct Primary Source Link */}
        {lead?.url && (
          <a
            href={lead.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Read primary source on ${lead?.sourceName || lead?.domain}`}
            aria-label={`Read primary source in new tab: ${leadTitle} on ${lead?.sourceName || lead?.domain}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/80 px-2 py-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="hidden sm:inline truncate max-w-[140px]">
              {lead?.sourceName || lead?.domain}
            </span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
          </a>
        )}
      </div>

      {/* Elevated Headline & Summary Excerpt (Primary Visual Anchor) */}
      <div className="space-y-1.5 my-2">
        <button
          type="button"
          onClick={() => onOpenSummary(cluster)}
          className="text-left w-full group/title cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
        >
          <h4 className="font-display text-base sm:text-lg font-semibold leading-snug tracking-tight text-foreground group-hover/title:text-primary transition-colors text-balance">
            {leadTitle}
          </h4>
        </button>

        {summaryText && (
          <p className="font-sans text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {summaryText}
          </p>
        )}
      </div>

      {/* Calm Metadata Footer: Telemetry & Actions */}
      <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
        {/* Left: Sources Provenance, Sentiment, Impact Rating */}
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          {/* Source Favicons & Count */}
          <div className="flex items-center gap-1.5">
            {!cluster.isSingleton ? (
              <div className="flex -space-x-1.5 shrink-0">
                {uniqueArticles.slice(0, 3).map((a) => (
                  <DomainIcon key={a.id} domain={a.domain} />
                ))}
              </div>
            ) : (
              <DomainIcon domain={lead?.domain ?? ""} />
            )}
            <span
              title={
                !cluster.isSingleton
                  ? `${uniqueArticles.length} unique domain reports consolidated by semantic clustering`
                  : `Single source reporting: ${lead?.sourceName || lead?.domain}`
              }
              className="font-sans text-[11px] font-medium text-foreground/80 cursor-help"
            >
              {!cluster.isSingleton
                ? `${uniqueArticles.length} sources consolidated`
                : lead?.sourceName || lead?.domain}
            </span>
          </div>

          {/* Sentiment Indicator */}
          {cluster.sentiment && (
            <>
              <span className="text-border/80 select-none">•</span>
              <span
                title={`Algorithmic sentiment: ${cluster.sentiment.toLowerCase()} consensus`}
                className="inline-flex items-center gap-1 font-sans text-[11px]"
              >
                <span className={`size-1.5 rounded-full shrink-0 ${sentimentConfig.dotColor}`} />
                <span className="capitalize">{cluster.sentiment}</span>
              </span>
            </>
          )}

          {/* Impact Rating */}
          {cluster.importanceScore !== undefined && (
            <>
              <span className="text-border/80 select-none">•</span>
              <span
                title={`Ecosystem impact: evaluated ${cluster.importanceScore}/10 for technical novelty and industry impact`}
                className="inline-flex items-center gap-0.5 font-mono text-[11px]"
              >
                {cluster.importanceScore >= 8 && (
                  <span className="text-amber-500 font-bold" aria-label="High impact">
                    ★
                  </span>
                )}
                <span>Impact {cluster.importanceScore}/10</span>
              </span>
            </>
          )}
        </div>

        {/* Right: Briefing CTA & Keyboard Accelerator */}
        <div className="flex items-center gap-2 shrink-0">
          {isFocused && (
            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full animate-in fade-in duration-150">
              <kbd className="font-sans font-bold">Enter</kbd> to open
            </span>
          )}
          <button
            type="button"
            onClick={() => onOpenSummary(cluster)}
            title="Read synthesized briefing and key takeaways"
            aria-label={`Open briefing for story: ${leadTitle}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary font-sans text-xs font-semibold px-3 py-1 transition-all shadow-xs active:scale-[0.98] cursor-pointer min-h-[30px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 shrink-0"
          >
            <FileText className="h-3 w-3" />
            <span>View Summary</span>
          </button>
        </div>
      </div>
    </article>
  )
})

export function NewsList({
  clusters,
  filters,
  searchQuery,
  onResetFilters,
  selectedCluster: controlledSelectedCluster,
  onSelectCluster: controlledOnSelectCluster,
}: NewsListProps) {
  const [internalSelectedCluster, setInternalSelectedCluster] = useState<Cluster | null>(null)
  const isControlled = controlledSelectedCluster !== undefined
  const selectedCluster = isControlled ? controlledSelectedCluster : internalSelectedCluster

  const setSelectedCluster = useCallback(
    (cluster: Cluster | null) => {
      if (controlledOnSelectCluster) {
        controlledOnSelectCluster(cluster)
      }
      if (!isControlled) {
        setInternalSelectedCluster(cluster)
      }
    },
    [controlledOnSelectCluster, isControlled]
  )

  const [focusedClusterId, setFocusedClusterId] = useState<string | null>(null)
  const [sortBy] = (filters.sort || "date-desc").split("-") as ["date" | "domain", "asc" | "desc"]

  const handleOpenSummary = useCallback(
    (cluster: Cluster) => {
      setSelectedCluster(cluster)
    },
    [setSelectedCluster]
  )

  const grouped = useMemo(() => {
    const map: Record<string, Cluster[]> = {}
    for (const cluster of clusters) {
      const key =
        sortBy === "domain"
          ? (cluster.articles[0]?.domain ?? "Unknown")
          : formatDateLong(cluster.publishedAt)
      if (!map[key]) map[key] = []
      map[key].push(cluster)
    }
    return map
  }, [clusters, sortBy])

  const sectionKeys = useMemo(() => {
    const [, sortOrder] = (filters.sort || "date-desc").split("-") as [
      "date" | "domain",
      "asc" | "desc",
    ]
    return Object.keys(grouped).sort((a, b) => {
      const cmp =
        sortBy === "domain" ? a.localeCompare(b) : new Date(a).getTime() - new Date(b).getTime()
      return sortOrder === "asc" ? cmp : -cmp
    })
  }, [grouped, filters.sort, sortBy])

  const flatClusters = useMemo(() => {
    return sectionKeys.flatMap((key) => grouped[key] || [])
  }, [sectionKeys, grouped])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName || ""
      const isInputActive = ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)
      if (isInputActive || selectedCluster) return

      if (e.key === "j" || (e.key === "ArrowDown" && !e.metaKey && !e.ctrlKey)) {
        if (!flatClusters.length) return
        e.preventDefault()
        setFocusedClusterId((curr) => {
          const idx = flatClusters.findIndex((c) => c.id === curr)
          const nextIdx = idx === -1 ? 0 : Math.min(idx + 1, flatClusters.length - 1)
          const target = flatClusters[nextIdx]
          const el = document.getElementById(`cluster-card-${target.id}`)
          el?.scrollIntoView({ block: "nearest", behavior: "smooth" })
          el?.focus({ preventScroll: true })
          return target.id
        })
      } else if (e.key === "k" || (e.key === "ArrowUp" && !e.metaKey && !e.ctrlKey)) {
        if (!flatClusters.length) return
        e.preventDefault()
        setFocusedClusterId((curr) => {
          const idx = flatClusters.findIndex((c) => c.id === curr)
          const prevIdx = idx === -1 ? 0 : Math.max(idx - 1, 0)
          const target = flatClusters[prevIdx]
          const el = document.getElementById(`cluster-card-${target.id}`)
          el?.scrollIntoView({ block: "nearest", behavior: "smooth" })
          el?.focus({ preventScroll: true })
          return target.id
        })
      } else if (e.key === "Enter" || e.key === "o") {
        if (focusedClusterId) {
          const target = flatClusters.find((c) => c.id === focusedClusterId)
          if (target) {
            e.preventDefault()
            setSelectedCluster(target)
          }
        }
      } else if (e.key === "Escape") {
        if (focusedClusterId) {
          e.preventDefault()
          setFocusedClusterId(null)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [flatClusters, focusedClusterId, selectedCluster, setSelectedCluster])

  if (clusters.length === 0) {
    return (
      <div className="rounded-xl border border-border/80 bg-card py-12 px-6 text-center shadow-xs flex flex-col items-center">
        <div className="size-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-3 border border-border/60">
          <FileText className="size-5 opacity-60" />
        </div>
        <p className="font-display text-base sm:text-lg font-semibold text-foreground">
          {searchQuery ? `No results for “${searchQuery}”` : "No stories match active filters"}
        </p>
        <p className="font-sans text-xs text-muted-foreground mt-1.5 max-w-md mx-auto">
          {searchQuery
            ? "Try broadening your search term or clearing filter criteria."
            : "Try resetting category, source, or date range filters to view latest stories."}
        </p>
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-4 inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-primary-foreground bg-primary hover:opacity-95 px-3.5 py-1.5 rounded-full transition-all shadow-xs active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset all filters</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {sectionKeys.map((sectionKey) => (
        <section key={sectionKey} className="space-y-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
            <div>
              {sortBy === "domain" && (
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground block">
                  Source Domain
                </span>
              )}
              <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-foreground leading-tight">
                {sectionKey}
              </h3>
            </div>
            <span className="rounded-full bg-muted/80 px-2 py-0.5 font-mono text-[11px] text-muted-foreground border border-border/60">
              {grouped[sectionKey].length} {grouped[sectionKey].length === 1 ? "story" : "stories"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {grouped[sectionKey].map((cluster) => (
              <ClusterCard
                key={cluster.id}
                cluster={cluster}
                isFocused={cluster.id === focusedClusterId}
                onOpenSummary={handleOpenSummary}
              />
            ))}
          </div>
        </section>
      ))}

      <SummaryModal
        cluster={selectedCluster}
        open={!!selectedCluster}
        onOpenChange={(open) => !open && setSelectedCluster(null)}
      />
    </div>
  )
}
