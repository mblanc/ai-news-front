import { describe, it, expect } from "vitest"
import { GoogleGenAI } from "@google/genai"

const ai = new GoogleGenAI({
  enterprise: true,
  project: process.env.GOOGLE_CLOUD_PROJECT_ID,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? "global",
})

describe("embed (live GEAP)", () => {
  it("returns a 768-dimensional float array for a short text", async () => {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-2",
      contents: "Artificial intelligence is transforming the world.",
      config: { taskType: "SEMANTIC_SIMILARITY", outputDimensionality: 768 },
    })

    const values = response.embeddings?.[0]?.values ?? []
    expect(values.length).toBe(768)
    expect(values.every((v) => typeof v === "number" && isFinite(v))).toBe(true)
  }, 30_000)
})
