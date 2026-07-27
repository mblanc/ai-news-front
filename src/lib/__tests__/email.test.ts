import { describe, it, expect } from "vitest"
import { renderDigestHtml, renderDigestText } from "../email"
import type { Digest, Cluster, GroundedInsight } from "../types"

describe("Email Digest Rendering", () => {
  const sampleDigest: Digest = {
    headline: "Major AI Model Releases and Policy Changes",
    insights: [
      {
        text: "Frontier model efficiency improved dramatically this week.",
        sources: [
          {
            title: "Model Efficiency Report",
            url: "https://example.com/report",
            domain: "example.com",
            sourceName: "AI Research",
          },
        ],
      } satisfies GroundedInsight,
      "Ungrounded insight string for backward compatibility.",
    ],
    generatedAt: new Date("2026-07-27T10:00:00Z"),
  }

  const sampleClusters: Cluster[] = [
    {
      id: "cluster-1",
      summary: "Anthropic introduces new Claude capabilities with agentic tools.",
      topicTag: "model-release",
      sentiment: "positive",
      entities: ["Anthropic", "Claude"],
      isSingleton: false,
      articleCount: 2,
      articles: [
        {
          id: "art-1",
          title: "Claude Agentic Release",
          url: "https://example.com/claude",
          domain: "example.com",
          sourceId: "src-1",
          sourceName: "Anthropic News",
          excerpt: "Excerpt",
          relevanceScore: 9,
        },
      ],
      createdAt: new Date(),
      publishedAt: new Date(),
    },
  ]

  it("renders HTML email template with headline, insights, and clusters", () => {
    const html = renderDigestHtml(sampleDigest, sampleClusters)

    expect(html).toContain("Major AI Model Releases and Policy Changes")
    expect(html).toContain("Frontier model efficiency improved dramatically this week.")
    expect(html).toContain("https://example.com/report")
    expect(html).toContain("Model Efficiency Report")
    expect(html).toContain("Anthropic introduces new Claude capabilities")
    expect(html).toContain("model-release")
  })

  it("renders plain text email fallback correctly", () => {
    const text = renderDigestText(sampleDigest, sampleClusters)

    expect(text).toContain("HEADLINE:\nMajor AI Model Releases and Policy Changes")
    expect(text).toContain("Frontier model efficiency improved dramatically this week.")
    expect(text).toContain("https://example.com/report")
    expect(text).toContain("[MODEL-RELEASE] Anthropic introduces new Claude capabilities")
  })

  it("handles null digest and empty clusters gracefully", () => {
    const html = renderDigestHtml(null, [])
    const text = renderDigestText(null, [])

    expect(html).toContain("Daily AI News Briefing")
    expect(html).toContain("No AI synthesis digest available for today.")
    expect(html).toContain("No new stories recorded in the past 24 hours.")

    expect(text).toContain("No digest available today.")
    expect(text).toContain("No new stories in the past 24 hours.")
  })
})
