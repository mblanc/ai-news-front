"use client"

import { useMemo, useState } from "react"
import { ExternalLink, ChevronDown, ChevronUp } from "lucide-react"
import { DomainIcon } from "@/components/domain-icon"
import { formatDate, formatDateLong } from "@/lib/format-date"
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

function ClusterCard({ cluster }: { cluster: Cluster }) {
  const [summaryOpen, setSummaryOpen] = useState(false)
  const lead = cluster.articles[0]
  const leadTitle = lead?.title ?? "Untitled"

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
      </div>

      {/* title row */}
      {cluster.isSingleton ? (
        <a
          href={lead?.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 group"
        >
          <DomainIcon domain={lead?.domain ?? ""} />
          <span className="font-newsreader text-lg leading-snug text-foreground group-hover:text-muted-foreground transition-colors flex-1">
            {leadTitle}
          </span>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
        </a>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1 shrink-0">
            {cluster.articles.slice(0, 4).map((a) => (
              <DomainIcon key={a.id} domain={a.domain} />
            ))}
          </div>
          <span className="font-newsreader text-lg leading-snug text-foreground">{leadTitle}</span>
        </div>
      )}

      {/* summary toggle */}
      {cluster.summary && (
        <div className="mt-2">
          <button
            onClick={() => setSummaryOpen((o) => !o)}
            className="flex items-center gap-1 font-sans text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {summaryOpen ? (
              <>
                <ChevronUp className="h-3 w-3" /> Hide
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> Show summary
              </>
            )}
          </button>

          {summaryOpen && (
            <div className="mt-2 space-y-2">
              <p className="font-newsreader text-base leading-snug text-muted-foreground">
                {cluster.summary}
              </p>
              {!cluster.isSingleton && (
                <div className="space-y-1.5 pt-1">
                  {cluster.articles.map((article) => (
                    <div key={article.id} className="flex items-center gap-2">
                      <DomainIcon domain={article.domain} />
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-sans text-sm text-foreground hover:text-muted-foreground transition-colors flex items-center gap-1 group"
                      >
                        {article.title}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function NewsList({ clusters, filters, searchQuery }: NewsListProps) {
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
              <ClusterCard key={cluster.id} cluster={cluster} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
