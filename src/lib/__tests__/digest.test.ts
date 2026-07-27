import { describe, it, expect } from "vitest"
import type { Digest, GroundedInsight } from "../types"

describe("Digest Grounding Sources Data Structure", () => {
  it("supports grounded insights with source metadata", () => {
    const groundedInsight: GroundedInsight = {
      text: "DeepSeek released R1 distilled models which set open-weight benchmarks.",
      sources: [
        {
          title: "DeepSeek-R1 Release",
          url: "https://example.com/deepseek-r1",
          domain: "example.com",
          sourceName: "Tech Blog",
        },
      ],
    }

    const digest: Digest = {
      headline: "AI Open Models Advance Rapidly",
      insights: [groundedInsight, "Legacy ungrounded insight string"],
      generatedAt: new Date(),
    }

    expect(digest.insights).toHaveLength(2)
    const first = digest.insights[0] as GroundedInsight
    expect(first.text).toBe(
      "DeepSeek released R1 distilled models which set open-weight benchmarks."
    )
    expect(first.sources[0].url).toBe("https://example.com/deepseek-r1")
    expect(first.sources[0].sourceName).toBe("Tech Blog")
  })
})
