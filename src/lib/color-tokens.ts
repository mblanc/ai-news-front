import type { SourceCategory } from "@/lib/types"

/**
 * Editorial category color accents grounded in AM3 tonal palettes.
 * Provides high-contrast, harmonious tints for light and dark modes (≥4.5:1).
 */
export const CATEGORY_ACCENT_CLASSES: Record<
  SourceCategory | "all",
  {
    badge: string
    activeTab: string
    dotColor: string
  }
> = {
  all: {
    badge: "bg-primary/10 text-primary border-primary/25",
    activeTab: "bg-primary text-primary-foreground font-semibold border-primary shadow-xs",
    dotColor: "bg-primary",
  },
  "ai-engineering": {
    badge:
      "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 font-medium",
    activeTab:
      "bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white font-semibold border-emerald-700 shadow-xs",
    dotColor: "bg-emerald-500",
  },
  "frontier-research": {
    badge: "bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30 font-medium",
    activeTab:
      "bg-purple-600 text-white dark:bg-purple-600 dark:text-white font-semibold border-purple-700 shadow-xs",
    dotColor: "bg-purple-500",
  },
  genmedia: {
    badge: "bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30 font-medium",
    activeTab:
      "bg-rose-600 text-white dark:bg-rose-600 dark:text-white font-semibold border-rose-700 shadow-xs",
    dotColor: "bg-rose-500",
  },
  "ecosystem-analysis": {
    badge: "bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30 font-medium",
    activeTab:
      "bg-sky-600 text-white dark:bg-sky-600 dark:text-white font-semibold border-sky-700 shadow-xs",
    dotColor: "bg-sky-500",
  },
  "industry-news": {
    badge: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-500/30 font-medium",
    activeTab:
      "bg-indigo-600 text-white dark:bg-indigo-600 dark:text-white font-semibold border-indigo-700 shadow-xs",
    dotColor: "bg-indigo-500",
  },
}

/**
 * Topic tag badges for individual stories and clusters.
 */
export const TOPIC_TAG_CLASSES: Record<string, string> = {
  "model-release":
    "bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30 font-medium",
  research:
    "bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-500/30 font-medium",
  agents:
    "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 font-medium",
  funding: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 font-medium",
  product: "bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30 font-medium",
  policy: "bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30 font-medium",
  hardware:
    "bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-300 border-fuchsia-500/30 font-medium",
  industry: "bg-secondary text-secondary-foreground border-border/80 font-medium",
  opinion: "bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/30 font-medium",
  education: "bg-lime-500/15 text-lime-900 dark:text-lime-300 border-lime-500/30 font-medium",
  other: "bg-secondary text-secondary-foreground border-border/80 font-medium",
}

/**
 * Multi-source sentiment indicators with semantic color tints and accessible dot indicators.
 */
export const SENTIMENT_CONFIG: Record<
  string,
  {
    className: string
    dotColor: string
    label: string
  }
> = {
  positive: {
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
    dotColor: "bg-emerald-500",
    label: "Positive",
  },
  negative: {
    className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25",
    dotColor: "bg-rose-500",
    label: "Negative",
  },
  neutral: {
    className: "bg-secondary/60 text-muted-foreground border-border/70",
    dotColor: "bg-muted-foreground/60",
    label: "Neutral",
  },
}

/**
 * Visual styling for ecosystem impact ratings (1-10).
 * Emphasizes breakthrough high-impact events (≥8) with warm golden accents.
 */
export function getImpactBadgeConfig(score: number): {
  className: string
  isHigh: boolean
} {
  if (score >= 8) {
    return {
      className:
        "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 font-semibold shadow-xs",
      isHigh: true,
    }
  }
  if (score >= 6) {
    return {
      className: "bg-primary/10 text-primary border-primary/25 font-medium",
      isHigh: false,
    }
  }
  return {
    className: "bg-muted/70 text-muted-foreground border-border/60 font-medium",
    isHigh: false,
  }
}
