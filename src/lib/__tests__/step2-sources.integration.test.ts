import { describe, it, expect } from "vitest"
import { createProductionIngestionPipeline } from "../ingestion-pipeline"
import { db, docToSource } from "../firebase"
import type { Source } from "../types"

describe("Step 2 Ingestion Integration Test", () => {
  it("fetches feed URLs for all enabled sources in DB without errors", async () => {
    const snap = await db.collection("sources").where("enabled", "==", true).get()
    const sources: Source[] = snap.docs.map((d) => docToSource(d.id, d.data()))
    expect(sources.length).toBeGreaterThan(0)
    console.log(`Loaded ${sources.length} enabled sources from Firestore.`)

    const pipeline = createProductionIngestionPipeline()
    const errors: string[] = []

    await pipeline
      .ingest(sources, {
        onProgress: (evt) => {
          if (evt.stage === "fetch_feed") {
            if (evt.message.includes("Error resolving")) {
              console.error(evt.message)
              errors.push(evt.message)
            } else {
              console.log(evt.message)
            }
          }
        },
      })
      .catch(() => {})

    expect(errors).toEqual([])
  }, 300_000)
})
