"use client"

import { useRef, useEffect } from "react"
import type { SourceCategory } from "@/lib/types"
import { CATEGORY_ACCENT_CLASSES } from "@/lib/color-tokens"

export interface CategoryOption {
  id: SourceCategory | "all"
  label: string
  shortLabel?: string
  icon: string
  description: string
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    id: "all",
    label: "State of AI",
    shortLabel: "All",
    icon: "🌐",
    description: "Holistic pulse across models, industry & breakthroughs",
  },
  {
    id: "ai-engineering",
    label: "AI Engineering",
    shortLabel: "Engineering",
    icon: "🛠️",
    description: "SDKs, frameworks, infra, eval & dev workflows",
  },
  {
    id: "frontier-research",
    label: "Frontier R&D",
    shortLabel: "Research",
    icon: "🧪",
    description: "Fundamental architectures, arXiv papers & benchmark shifts",
  },
  {
    id: "genmedia",
    label: "GenMedia",
    shortLabel: "Media",
    icon: "🎨",
    description: "Generative video, 3D, audio, multimodal & creative tooling",
  },
  {
    id: "ecosystem-analysis",
    label: "Ecosystem Analysis",
    shortLabel: "Ecosystem",
    icon: "📰",
    description: "Macro trends, regulation, safety & strategic analysis",
  },
  {
    id: "industry-news",
    label: "Industry News",
    shortLabel: "Industry",
    icon: "🏢",
    description: "Corporate partnerships, funding, enterprise & product launches",
  },
]

interface CategoryNavProps {
  activeCategory: SourceCategory | "all"
  onSelectCategory: (category: SourceCategory | "all") => void
  clusterCounts?: Partial<Record<SourceCategory | "all", number>>
  className?: string
}

export function CategoryNav({
  activeCategory = "all",
  onSelectCategory,
  clusterCounts,
  className = "",
}: CategoryNavProps) {
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([])

  // Ensure active tab scrolls into view on mobile
  useEffect(() => {
    const activeIndex = CATEGORY_OPTIONS.findIndex((c) => c.id === activeCategory)
    if (activeIndex >= 0 && tabsRef.current[activeIndex]) {
      tabsRef.current[activeIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      })
    }
  }, [activeCategory])

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let targetIndex = -1

    if (e.key === "ArrowRight") {
      e.preventDefault()
      targetIndex = (index + 1) % CATEGORY_OPTIONS.length
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      targetIndex = (index - 1 + CATEGORY_OPTIONS.length) % CATEGORY_OPTIONS.length
    } else if (e.key === "Home") {
      e.preventDefault()
      targetIndex = 0
    } else if (e.key === "End") {
      e.preventDefault()
      targetIndex = CATEGORY_OPTIONS.length - 1
    }

    if (targetIndex >= 0) {
      const nextCategory = CATEGORY_OPTIONS[targetIndex].id
      onSelectCategory(nextCategory)
      tabsRef.current[targetIndex]?.focus()
    }
  }

  return (
    <nav
      aria-label="Editorial Categories"
      className={`sticky top-12 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md transition-colors ${className}`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div
          role="tablist"
          aria-label="Filter stories by editorial category"
          className="flex items-center gap-1.5 overflow-x-auto py-2.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]"
        >
          {CATEGORY_OPTIONS.map((cat, index) => {
            const isSelected = activeCategory === cat.id
            const accent = CATEGORY_ACCENT_CLASSES[cat.id]
            const count = clusterCounts?.[cat.id]

            return (
              <button
                key={cat.id}
                ref={(el) => {
                  tabsRef.current[index] = el
                }}
                role="tab"
                id={`category-tab-${cat.id}`}
                aria-selected={isSelected}
                aria-controls="main-feed"
                tabIndex={isSelected ? 0 : -1}
                title={cat.description}
                onClick={() => onSelectCategory(cat.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className={`group shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-full font-sans text-xs tracking-tight transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-1 min-h-[34px] ${
                  isSelected
                    ? `${accent.activeTab} shadow-xs font-semibold scale-[1.02]`
                    : "bg-muted/40 hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/60 hover:border-border"
                }`}
              >
                <span className="text-sm leading-none">{cat.icon}</span>
                <span className="font-medium">{cat.label}</span>
                {typeof count === "number" && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded-full font-mono text-[10px] font-medium leading-none ${
                      isSelected
                        ? "bg-white/20 text-inherit"
                        : "bg-muted text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
