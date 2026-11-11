import { db, getTtlExpirationDate } from "@/lib/firebase"
import type { DigestScope } from "@/lib/types"
import type { VideoCostBreakdown } from "@/lib/video/cost"
import {
  assertPrivateGcsObjectPath,
  buildVideoDocId,
  type CriticVerdict,
  type VideoCategory,
  type VideoDocument,
} from "@/lib/video/types"

export const DIGEST_VIDEOS_COLLECTION = "digest_videos"

export interface SaveReadyVideoInput {
  date: string
  digestId: DigestScope
  category: VideoCategory
  gcsVideoPath: string
  gcsPosterPath: string
  gcsManifestPath?: string
  durationSec: number
  lufs: number
  headline: string
  insightCount: number
  criticVerdict: CriticVerdict
  criticRounds: number
  criticNotes: string
  cost?: VideoCostBreakdown
}

export interface VideoFirestoreAdapter {
  setDoc(id: string, data: Record<string, unknown>): Promise<void>
  getDoc(id: string): Promise<Record<string, unknown> | null>
  queryLatestReady(scope: DigestScope, category: VideoCategory): Promise<VideoDocument | null>
}

function hydrateVideoDoc(id: string, raw: Record<string, unknown>): VideoDocument {
  const generatedAtRaw = raw.generatedAt as { toDate?: () => Date } | string | undefined
  const generatedAt =
    typeof generatedAtRaw === "string"
      ? generatedAtRaw
      : typeof generatedAtRaw?.toDate === "function"
        ? generatedAtRaw.toDate().toISOString()
        : new Date().toISOString()

  return {
    id,
    date: String(raw.date ?? ""),
    digestId: (raw.digestId as DigestScope) ?? "daily",
    category: (raw.category as VideoCategory) ?? "all",
    status: (raw.status as VideoDocument["status"]) ?? "ready",
    gcsVideoPath: String(raw.gcsVideoPath ?? ""),
    gcsPosterPath: String(raw.gcsPosterPath ?? ""),
    gcsManifestPath: raw.gcsManifestPath ? String(raw.gcsManifestPath) : undefined,
    durationSec: Number(raw.durationSec ?? 0),
    lufs: Number(raw.lufs ?? -16),
    generatedAt,
    headline: String(raw.headline ?? ""),
    insightCount: Number(raw.insightCount ?? 0),
    criticVerdict: (raw.criticVerdict as CriticVerdict) ?? "NEEDS_REVIEW",
    criticRounds: Number(raw.criticRounds ?? 1),
    criticNotes: String(raw.criticNotes ?? ""),
    cost: raw.cost && typeof raw.cost === "object" ? (raw.cost as VideoCostBreakdown) : undefined,
    error: raw.error ? String(raw.error) : undefined,
  }
}

export function createDefaultVideoFirestoreAdapter(): VideoFirestoreAdapter {
  return {
    async setDoc(id, data) {
      await db
        .collection(DIGEST_VIDEOS_COLLECTION)
        .doc(id)
        .set({ ...data, expireAt: getTtlExpirationDate() }, { merge: true })
    },
    async getDoc(id) {
      const snap = await db.collection(DIGEST_VIDEOS_COLLECTION).doc(id).get()
      return snap.exists ? (snap.data() ?? {}) : null
    },
    async queryLatestReady(scope, category) {
      const snap = await db
        .collection(DIGEST_VIDEOS_COLLECTION)
        .where("digestId", "==", scope)
        .where("category", "==", category)
        .get()
      if (snap.empty) return null
      const ready = snap.docs
        .map((doc) => hydrateVideoDoc(doc.id, doc.data()))
        .filter((doc) => doc.status === "ready")
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
      return ready[0] ?? null
    },
  }
}

export function createDigestVideoRepo(adapter: VideoFirestoreAdapter) {
  return {
    async saveReady(input: SaveReadyVideoInput): Promise<VideoDocument> {
      const id = buildVideoDocId(input.date, input.digestId, input.category)
      const gcsVideoPath = assertPrivateGcsObjectPath(input.gcsVideoPath, "gcsVideoPath")
      const gcsPosterPath = assertPrivateGcsObjectPath(input.gcsPosterPath, "gcsPosterPath")
      const gcsManifestPath = input.gcsManifestPath
        ? assertPrivateGcsObjectPath(input.gcsManifestPath, "gcsManifestPath")
        : undefined

      const doc: VideoDocument = {
        id,
        date: input.date,
        digestId: input.digestId,
        category: input.category,
        status: "ready",
        gcsVideoPath,
        gcsPosterPath,
        gcsManifestPath,
        durationSec: input.durationSec,
        lufs: input.lufs,
        generatedAt: new Date().toISOString(),
        headline: input.headline,
        insightCount: input.insightCount,
        criticVerdict: input.criticVerdict,
        criticRounds: input.criticRounds,
        criticNotes: input.criticNotes,
        ...(input.cost ? { cost: input.cost } : {}),
      }
      await adapter.setDoc(id, doc as unknown as Record<string, unknown>)
      return doc
    },

    async getById(id: string): Promise<VideoDocument | null> {
      const raw = await adapter.getDoc(id)
      return raw ? hydrateVideoDoc(id, raw) : null
    },

    async getReadyForDate(
      date: string,
      scope: DigestScope,
      category: VideoCategory
    ): Promise<VideoDocument | null> {
      const id = buildVideoDocId(date, scope, category)
      const raw = await adapter.getDoc(id)
      if (!raw) return null
      const doc = hydrateVideoDoc(id, raw)
      return doc.status === "ready" && doc.date === date ? doc : null
    },

    async getLatestReady(
      scope: DigestScope,
      category: VideoCategory
    ): Promise<VideoDocument | null> {
      return adapter.queryLatestReady(scope, category)
    },
  }
}

let defaultRepo: ReturnType<typeof createDigestVideoRepo> | null = null
export function getDigestVideoRepo() {
  if (!defaultRepo) {
    defaultRepo = createDigestVideoRepo(createDefaultVideoFirestoreAdapter())
  }
  return defaultRepo
}
