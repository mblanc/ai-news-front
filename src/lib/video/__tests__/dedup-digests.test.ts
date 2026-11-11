import { describe, it, expect } from "vitest"
import { mergeAndDeduplicateDigests, normalizeStoryUrl } from "@/lib/video/dedup-digests"
import type { Digest } from "@/lib/types"

describe("normalizeStoryUrl", () => {
  it("strips www, trailing slashes, hashes, and tracking params", () => {
    expect(
      normalizeStoryUrl(
        "https://www.TheVerge.com/ai/2026/agents-hub/?utm_source=rss&utm_medium=feed&id=42#top"
      )
    ).toBe("https://theverge.com/ai/2026/agents-hub?id=42")
  })
})

describe("mergeAndDeduplicateDigests", () => {
  it("merges overlapping stories across all 6 category digests by shared URL and preserves unique stories", () => {
    const allDigest: Digest = {
      headline: "State of AI Canonical Headline",
      generatedAt: new Date("2026-11-11T08:00:00Z"),
      insights: [
        {
          text: "Anthropic kicks off a $1T IPO roadshow following 2x R&D productivity gains.",
          sources: [
            {
              title: "Anthropic IPO Roadshow",
              url: "https://www.the-decoder.com/anthropic-ipo/?utm_source=rss",
              domain: "the-decoder.com",
            },
          ],
        },
        {
          text: "DeepMind formally verified the Signal Protocol using AlphaProof Code.",
          sources: [
            {
              title: "AlphaProof Signal",
              url: "https://wired.com/story/alphaproof-signal/",
              domain: "wired.com",
            },
          ],
        },
      ],
    }

    const engDigest: Digest = {
      headline: "Engineering Headline",
      generatedAt: new Date("2026-11-11T08:01:00Z"),
      insights: [
        {
          text: "Anthropic translates internal 2x R&D velocity into enterprise coding agents ahead of IPO.",
          sources: [
            {
              title: "Anthropic IPO",
              url: "https://the-decoder.com/anthropic-ipo",
              domain: "the-decoder.com",
            },
            {
              title: "Claude Mythos",
              url: "https://techcrunch.com/claude-mythos",
              domain: "techcrunch.com",
            },
          ],
        },
        {
          text: "ComfyUI v0.45 integrates MiniMax H3 Image locally.",
          sources: [
            {
              title: "ComfyUI v0.45",
              url: "https://blog.comfy.org/p/minimax-h3/",
              domain: "blog.comfy.org",
            },
          ],
        },
      ],
    }

    const genmediaDigest: Digest = {
      headline: "GenMedia Headline",
      generatedAt: new Date("2026-11-11T08:02:00Z"),
      insights: [
        {
          text: "ComfyUI v0.45 and 33.1B MiniMax H3 unlock local high-fidelity image synthesis.",
          sources: [
            {
              title: "MiniMax H3",
              url: "https://blog.comfy.org/p/minimax-h3",
              domain: "blog.comfy.org",
            },
          ],
        },
        {
          text: "Runway releases open-weight Praxis-1 physical action world model.",
          sources: [
            {
              title: "Runway Praxis-1",
              url: "https://runwayml.com/news/praxis-1",
              domain: "runwayml.com",
            },
          ],
        },
      ],
    }

    const merged = mergeAndDeduplicateDigests({
      all: allDigest,
      "ai-engineering": engDigest,
      genmedia: genmediaDigest,
    })

    expect(merged.headline).toBe("State of AI Canonical Headline")
    expect(merged.rawInsightCount).toBe(6)
    // 6 raw insights -> 4 distinct stories: Anthropic IPO, ComfyUI/MiniMax, AlphaProof Signal, Runway Praxis-1
    expect(merged.insights).toHaveLength(4)

    const anthropic = merged.insights.find((i) => i.text.includes("Anthropic"))
    expect(anthropic).toBeDefined()
    expect(anthropic?.categories).toEqual(["all", "ai-engineering"])
    expect(anthropic?.sources).toHaveLength(2)
    expect(anthropic?.perspectives).toHaveLength(1)

    const comfy = merged.insights.find((i) => i.text.includes("ComfyUI"))
    expect(comfy?.categories).toEqual(["ai-engineering", "genmedia"])
  })

  it("merges multi-outlet coverage of the same named model (e.g. Gemini Robotics 2.5) and prunes redundant composite bullets", () => {
    const merged = mergeAndDeduplicateDigests({
      all: {
        headline: "Headline",
        generatedAt: new Date("2026-11-11T08:00:00Z"),
        insights: [
          {
            text: "Physical AI reaches factory precision with Google DeepMind's Gemini Robotics 2.5.",
            sources: [
              {
                title: "Blog",
                url: "https://deepmind.google/robotics-25",
                domain: "deepmind.google",
              },
              { title: "Pilot", url: "https://reuters.com/mercedes-pilot", domain: "reuters.com" },
              { title: "Video", url: "https://youtube.com/watch?v=1", domain: "youtube.com" },
              { title: "Spec", url: "https://arxiv.org/abs/2611.0001", domain: "arxiv.org" },
            ],
          },
          {
            text: "DeepMind AlphaProof Code verifies the Signal Protocol end-to-end.",
            sources: [
              { title: "Signal", url: "https://wired.com/alphaproof-signal", domain: "wired.com" },
            ],
          },
        ],
      },
      "frontier-research": {
        headline: "R&D",
        generatedAt: new Date("2026-11-11T08:01:00Z"),
        insights: [
          {
            text: "Gemini Robotics 2.5 scores 96% in Mercedes assembly pilot.",
            sources: [
              { title: "Pilot", url: "https://reuters.com/mercedes-pilot", domain: "reuters.com" },
              {
                title: "Decoder",
                url: "https://the-decoder.com/robotics",
                domain: "the-decoder.com",
              },
              { title: "Bench", url: "https://hf.co/papers/robotics", domain: "hf.co" },
            ],
          },
        ],
      },
      "industry-news": {
        headline: "Industry",
        generatedAt: new Date("2026-11-11T08:02:00Z"),
        insights: [
          {
            // Composite bullet mixing 2 already-covered URLs + 1 minor URL (66% covered -> pruned)
            text: "Industry roundup combining Signal verification and Mercedes robotics.",
            sources: [
              { title: "Signal", url: "https://wired.com/alphaproof-signal", domain: "wired.com" },
              { title: "Pilot", url: "https://reuters.com/mercedes-pilot", domain: "reuters.com" },
              { title: "Extra", url: "https://example.com/extra", domain: "example.com" },
            ],
          },
        ],
      },
    })

    expect(merged.insights).toHaveLength(2)
    expect(merged.insights[0].categories).toEqual(["all", "frontier-research"])
    expect(merged.insights[0].sources.length).toBeGreaterThanOrEqual(5)
  })
})
