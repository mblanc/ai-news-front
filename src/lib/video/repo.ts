import { db, getTtlExpirationDate } from "@/lib/firebase"
import { FieldValue } from "@google-cloud/firestore"
import type { DigestScope } from "@/lib/types"
import {
  assertPrivateGcsObjectPath,
  buildVideoDocId,
  type CriticVerdict,
  type FeedbackEntry,
  type FeedbackRating,
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
}

export interface VideoFirestoreAdapter {
  setDoc(id: string, data: Record<string, unknown>): Promise<void>
  getDoc(id: string): Promise<Record<string, unknown> | null>
  queryLatestReady(scope: DigestScope, category: VideoCategory): Promise<VideoDocument | null>
  appendFeedback(id: string, entry: FeedbackEntry): Promise<void>
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
    humanFeedback: Array.isArray(raw.humanFeedback)
      ? (raw.humanFeedback as FeedbackEntry[])
      : undefined,
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
      // Two equality filters use Firestore zig-zag merge without requiring a custom composite index.
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
    async appendFeedback(id, entry) {
      await db
        .collection(DIGEST_VIDEOS_COLLECTION)
        .doc(id)
        .update({
          humanFeedback: FieldValue.arrayUnion(entry),
          updatedAt: FieldValue.serverTimestamp(),
        })
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
      }
      await adapter.setDoc(id, doc as unknown as Record<string, unknown>)
      return doc
    },

    async getById(id: string): Promise<VideoDocument | null> {
      const raw = await adapter.getDoc(id)
      return raw ? hydrateVideoDoc(id, raw) : null
    },

    async getLatestReady(
      scope: DigestScope,
      category: VideoCategory
    ): Promise<VideoDocument | null> {
      return adapter.queryLatestReady(scope, category)
    },

    async addFeedback(
      id: string,
      feedback: { rating: FeedbackRating; note?: string; updatedBy?: string }
    ): Promise<FeedbackEntry> {
      const trimmedNote = feedback.note?.trim().slice(0, 1000)
      const entry: FeedbackEntry = {
        rating: feedback.rating,
        ...(trimmedNote ? { note: trimmedNote } : {}),
        updatedAt: new Date().toISOString(),
        ...(feedback.updatedBy ? { updatedBy: feedback.updatedBy } : {}),
      }
      await adapter.appendFeedback(id, entry)
      return entry
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
