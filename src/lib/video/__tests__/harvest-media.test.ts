import { describe, it, expect, vi } from "vitest"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  extractArticleImageCandidates,
  detectMentionedBrands,
  harvestDigestMediaAndLogos,
} from "@/lib/video/harvest-media"

describe("extractArticleImageCandidates", () => {
  it("ranks benchmark/chart figures ahead of generic photos and resolves srcset highest-res URL", () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="https://example.com/hero-banner.jpg" />
        </head>
        <body>
          <img src="/assets/site-logo.svg" alt="Site logo" />
          <article>
            <img src="https://example.com/editorial-photo.webp" alt="Data center exterior" width="1200" height="800" />
            <figure>
              <img
                src="/charts/small.png"
                srcset="/charts/small.png 640w, /charts/benchmark-comparison-2x.png 1600w"
                alt="SWE-bench benchmark accuracy chart across frontier models"
              />
              <figcaption>Figure 1: Benchmark throughput vs cost per token</figcaption>
            </figure>
            <img src="/pixel/tracker.gif" width="1" height="1" />
          </article>
        </body>
      </html>
    `

    const candidates = extractArticleImageCandidates(html, "https://blog.example.com/post/1")
    expect(candidates.length).toBeGreaterThanOrEqual(3)
    expect(candidates[0]).toMatchObject({
      url: "https://blog.example.com/charts/benchmark-comparison-2x.png",
      kind: "chart_or_diagram",
    })
    expect(candidates[0].caption).toContain("Benchmark throughput")
    expect(candidates.some((c) => c.url.includes("site-logo"))).toBe(false)
    expect(candidates.some((c) => c.url.includes("tracker.gif"))).toBe(false)
  })
})

describe("detectMentionedBrands", () => {
  it("detects mentioned AI labs, companies, and products with official logo sources", () => {
    const brands = detectMentionedBrands(
      "Google DeepMind's Gemini Robotics 2.5 scores 96% on Mercedes-Benz assembly while Anthropic and ElevenLabs expand.",
      ["deepmind.google", "elevenlabs.io"]
    )
    const slugs = brands.map((b) => b.slug)
    expect(slugs).toContain("googledeepmind")
    expect(slugs).toContain("mercedes")
    expect(slugs).toContain("anthropic")
    expect(slugs).toContain("elevenlabs")
  })
})

describe("harvestDigestMediaAndLogos", () => {
  it("downloads valid raster/SVG media and logos into projectDir/assets and skips HTML/tiny responses", async () => {
    const tmpProject = await fs.mkdtemp(path.join(os.tmpdir(), "harvest-test-"))
    try {
      // Valid PNG header + >= 12KB payload
      const fakePng = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(14_000, 0x42),
      ])
      const fakeSvg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>',
        "utf8"
      )

      const fetchMock = vi.fn(async (input: string | URL | Request) => {
        const url = String(input)
        if (url === "https://deepmind.google/blog/alphaproof") {
          return new Response(
            `<article>
              <figure>
                <img src="https://deepmind.google/img/alphaproof-benchmark-chart.png" alt="AlphaProof Lean 4 verification benchmark graph" />
              </figure>
            </article>`,
            { status: 200, headers: { "content-type": "text/html" } }
          )
        }
        if (url === "https://deepmind.google/img/alphaproof-benchmark-chart.png") {
          return new Response(fakePng, { status: 200, headers: { "content-type": "image/png" } })
        }
        if (url.includes("simpleicons.org") || url.includes("github.com")) {
          return new Response(fakeSvg, {
            status: 200,
            headers: { "content-type": "image/svg+xml" },
          })
        }
        return new Response("not found", { status: 404 })
      })

      const enriched = await harvestDigestMediaAndLogos(
        [
          {
            text: "Google DeepMind AlphaProof Code formally verifies the Signal Protocol.",
            sources: [
              {
                title: "AlphaProof",
                url: "https://deepmind.google/blog/alphaproof",
                domain: "deepmind.google",
              },
            ],
          },
        ],
        tmpProject,
        { fetchImpl: fetchMock as unknown as typeof fetch }
      )

      expect(enriched[0].candidateMedia).toHaveLength(1)
      expect(enriched[0].candidateMedia?.[0]).toMatchObject({
        localPath: expect.stringMatching(/^assets\/media\/story-01-01\.png$/),
        kind: "chart_or_diagram",
      })
      expect(enriched[0].logos?.length).toBeGreaterThanOrEqual(1)
      expect(enriched[0].logos?.[0].localPath).toMatch(/^assets\/logos\//)

      const mediaStat = await fs.stat(
        path.join(tmpProject, enriched[0].candidateMedia![0].localPath)
      )
      expect(mediaStat.size).toBeGreaterThan(12_000)
    } finally {
      await fs.rm(tmpProject, { recursive: true, force: true })
    }
  })
})
