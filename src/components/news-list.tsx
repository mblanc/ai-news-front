"use client"

import { useMemo, useState } from "react"
import { ExternalLink, FileText } from "lucide-react"
import { DomainIcon } from "@/components/domain-icon"
import { formatDate, formatDateLong } from "@/lib/format-date"
import { SummaryModal } from "@/components/summary-modal"
import type { Cluster } from "@/lib/types"
import type { FilterOptions } from "@/components/filter-panel"

interface NewsListProps {
  clusters: Cluster[]
  filters: FilterOptions
  searchQuery?: string
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

function ClusterCard({
  cluster,
  onOpenSummary,
}: {
  cluster: Cluster
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

  return (
    <div className="border-b border-border py-4 last:border-b-0">
      {/* meta row */}
      <div className="flex items-center gap-3 mb-1.5">
        <span className="border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
          {TAG_LABELS[cluster.topicTag] ?? cluster.topicTag}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatDate(cluster.publishedAt)}
        </span>
        {cluster.sentiment && (
          <span className="font-mono text-[10px] text-muted-foreground uppercase">
            • {cluster.sentiment}
          </span>
        )}
      </div>

      {/* title row */}
      <div className="flex items-start justify-between gap-3 group">
        <div
          className="flex items-start gap-2 flex-1 cursor-pointer min-w-0"
          onClick={() => onOpenSummary(cluster)}
        >
          {!cluster.isSingleton ? (
            <div className="flex -space-x-1 shrink-0 mt-1">
              {uniqueArticles.slice(0, 4).map((a) => (
                <DomainIcon key={a.id} domain={a.domain} />
              ))}
            </div>
          ) : (
            <div className="shrink-0 mt-1">
              <DomainIcon domain={lead?.domain ?? ""} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-newsreader text-lg sm:text-xl leading-snug text-foreground group-hover:text-muted-foreground transition-colors">
              {leadTitle}
            </h4>

            {/* Always display inline summary below the title */}
            {summaryText && (
              <p className="font-newsreader text-base text-muted-foreground leading-snug mt-1.5 line-clamp-3">
                {summaryText}
              </p>
            )}
          </div>
        </div>

        {/* Direct external link button */}
        {lead?.url && (
          <a
            href={lead.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Read full original article on external site"
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      {/* Action buttons row */}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onOpenSummary(cluster)}
          className="flex items-center gap-1.5 font-sans text-xs font-medium text-foreground bg-secondary/80 hover:bg-secondary border border-border px-2.5 py-1 transition-colors"
        >
          <FileText className="h-3.5 w-3.5 text-primary" />
          Summary
        </button>

        {!cluster.isSingleton && (
          <span className="font-mono text-xs text-muted-foreground">
            {uniqueArticles.length} sources
          </span>
        )}
      </div>
    </div>
  )
}

export function NewsList({ clusters, filters, searchQuery }: NewsListProps) {
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)
  const [sortBy] = (filters.sort || "date-desc").split("-") as ["date" | "domain", "asc" | "desc"]

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

  if (clusters.length === 0) {
    return (
      <div className="border border-border py-16 px-8">
        <p className="font-sans text-lg text-muted-foreground">
          {searchQuery ? `No results for “${searchQuery}”` : "No stories yet."}
        </p>
        <p className="font-sans text-sm text-muted-foreground mt-2">
          {searchQuery
            ? "Try a shorter or broader search term."
            : "Run the ingestion pipeline to populate the feed."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {sectionKeys.map((sectionKey) => (
        <div key={sectionKey}>
          <div className="border-b border-border pb-2 mb-0">
            {sortBy === "domain" && (
              <span className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground block mb-0.5">
                Source
              </span>
            )}
            <div className="flex items-baseline justify-between">
              <h3 className="font-newsreader text-xl sm:text-2xl text-foreground leading-tight">
                {sectionKey}
              </h3>
              <span className="font-sans text-xs text-muted-foreground">
                {grouped[sectionKey].length}{" "}
                {grouped[sectionKey].length === 1 ? "story" : "stories"}
              </span>
            </div>
          </div>

          <div>
            {grouped[sectionKey].map((cluster) => (
              <ClusterCard
                key={cluster.id}
                cluster={cluster}
                onOpenSummary={(c) => setSelectedCluster(c)}
              />
            ))}
          </div>
        </div>
      ))}

      <SummaryModal
        cluster={selectedCluster}
        open={!!selectedCluster}
        onOpenChange={(open) => !open && setSelectedCluster(null)}
      />
    </div>
  )
}
