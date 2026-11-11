import { describe, it, expect } from "vitest"
import { computeVideoGenerationCost } from "@/lib/video/cost"

describe("computeVideoGenerationCost", () => {
  it("computes LLM, TTS, Cloud Run vCPU/RAM, and total USD without double-counting thinking tokens", () => {
    const breakdown = computeVideoGenerationCost({
      model: "gemini-3.8-flash-medium",
      wallDurationSec: 1000, // ~16m40s on 8 vCPU / 16 GiB
      vcpu: 8,
      memoryGiB: 16,
      agyUsage: {
        inputTokens: 200_000, // $0.50 / 1M => $0.10
        cacheReadTokens: 800_000, // $0.05 / 1M => $0.04
        outputTokens: 50_000, // $3.00 / 1M => $0.15 (already includes thinkingTokens in agy!)
        thinkingTokens: 20_000,
        durationSeconds: 980,
      },
      ttsUsage: {
        promptTokens: 400, // $0.50 / 1M => $0.0002
        audioOutputTokens: 2_400, // $10.00 / 1M => $0.024
        characters: 1_250,
      },
    })

    // LLM: 0.10 + 0.04 + 0.15 = 0.29
    expect(breakdown.llmUsd).toBeCloseTo(0.29, 4)
    // TTS: 0.0002 + 0.024 = 0.0242
    expect(breakdown.ttsUsd).toBeCloseTo(0.0242, 4)
    // Compute: 1000 * (8 * 0.000018 + 16 * 0.000002) = 1000 * (0.000144 + 0.000032) = 0.176
    expect(breakdown.computeUsd).toBeCloseTo(0.176, 4)
    expect(breakdown.totalUsd).toBeCloseTo(0.29 + 0.0242 + 0.176 + breakdown.gcsUsd, 3)
  })
})
