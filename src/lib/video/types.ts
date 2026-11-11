import { z } from "zod"
import type { DigestScope, SourceCategory } from "@/lib/types"

export const VIDEO_CATEGORIES: readonly (SourceCategory | "all")[] = [
  "all",
  "ai-engineering",
  "frontier-research",
  "genmedia",
  "ecosystem-analysis",
  "industry-news",
] as const

export type VideoCategory = (typeof VIDEO_CATEGORIES)[number]
export type CriticVerdict = "OURS WINS" | "NEEDS_REVIEW"
export type VideoStatus = "rendering" | "ready" | "failed"
export type FeedbackRating = "up" | "down"

export interface FeedbackEntry {
  rating: FeedbackRating
  note?: string
  updatedAt: string
  updatedBy?: string
}

export interface VideoDocument {
  id: string
  date: string
  digestId: DigestScope
  category: VideoCategory
  status: VideoStatus
  gcsVideoPath: string
  gcsPosterPath: string
  gcsManifestPath?: string
  durationSec: number
  lufs: number
  generatedAt: string
  headline: string
  insightCount: number
  criticVerdict: CriticVerdict
  criticRounds: number
  criticNotes: string
  humanFeedback?: FeedbackEntry[]
  error?: string
}

export const AgyResultSchema = z.object({
  projectDir: z.string().min(1),
  mp4Path: z.string().min(1),
  criticVerdict: z.enum(["OURS WINS", "NEEDS_REVIEW"]),
  criticRounds: z.number().int().min(1).max(3),
  criticNotes: z.string(),
  sourcesManifestPath: z.string().min(1),
})

export type AgyResult = z.infer<typeof AgyResultSchema>

export function validateAgyResult(raw: unknown): AgyResult {
  return AgyResultSchema.parse(raw)
}

export function resolveCategoryFromTaskIndex(taskIndex: number): VideoCategory {
  if (!Number.isInteger(taskIndex) || taskIndex < 0 || taskIndex >= VIDEO_CATEGORIES.length) {
    throw new Error(
      `Invalid CLOUD_RUN_TASK_INDEX=${String(taskIndex)}; expected integer 0..${VIDEO_CATEGORIES.length - 1}`
    )
  }
  return VIDEO_CATEGORIES[taskIndex]
}

export function buildVideoDocId(
  date: string,
  digestId: DigestScope,
  category: VideoCategory
): string {
  return `${date}_${digestId}_${category}`
}

export function assertPrivateGcsObjectPath(path: string, label = "objectPath"): string {
  const segments = path ? path.split("/") : []
  if (
    !path ||
    /^https?:\/\//i.test(path) ||
    path.startsWith("gs://") ||
    path.startsWith("/") ||
    path.includes("\\") ||
    segments.some((seg) => seg === "" || seg === "." || seg === "..")
  ) {
    throw new Error(
      `Invalid GCS object path for ${label}: must be a relative private path, got: ${path}`
    )
  }
  return path
}
