import { describe, it, expect } from "vitest"
import { isIngestErrorLine } from "../ingest-log"

describe("isIngestErrorLine", () => {
  it("identifies error lines starting with Error or Fatal", () => {
    expect(isIngestErrorLine("Error: Ingestion failed unexpectedly")).toBe(true)
    expect(isIngestErrorLine("Fatal: Connection refused")).toBe(true)
  })

  it("identifies indented error lines from ingestion steps", () => {
    expect(isIngestErrorLine("  Error resolving Source Name: Connection timeout")).toBe(true)
    expect(isIngestErrorLine("  Error scraping https://example.com [example.com]: HTTP 500")).toBe(
      true
    )
    expect(isIngestErrorLine("  Failed to fetch page (404)")).toBe(true)
    expect(
      isIngestErrorLine("  No content extracted [example.com] — marking as fetch_failed")
    ).toBe(true)
    expect(
      isIngestErrorLine("  CloakBrowser failed [example.com] — trying Firecrawl fallback")
    ).toBe(true)
    expect(isIngestErrorLine("  All fallbacks failed [example.com] — will retry next run")).toBe(
      true
    )
    expect(isIngestErrorLine("  HTTP 404 [example.com] — marking as failed")).toBe(true)
    expect(isIngestErrorLine('  Score failed for "Title" — left as raw')).toBe(true)
    expect(isIngestErrorLine('  Embedding failed for "Title": Rate limit')).toBe(true)
    expect(isIngestErrorLine("  Summarising cluster failed, using default")).toBe(true)
  })

  it("does not classify normal ingestion log lines as error lines", () => {
    expect(isIngestErrorLine("Step 1/9 — Loading sources")).toBe(false)
    expect(isIngestErrorLine("Found 12 enabled sources")).toBe(false)
    expect(isIngestErrorLine("Source: TechCrunch")).toBe(false)
    expect(isIngestErrorLine("  TechCrunch: 15 items (2 too old, 13 kept)")).toBe(false)
    expect(isIngestErrorLine("13 unique URLs (2 filtered as too old)")).toBe(false)
    expect(isIngestErrorLine("Step 4/9 — Scraping articles")).toBe(false)
    expect(isIngestErrorLine('  Saved: "AI Breakthrough Released"')).toBe(false)
    expect(isIngestErrorLine("  Saved via CloakBrowser: https://example.com")).toBe(false)
    expect(isIngestErrorLine('  Relevant (score 8/10): "AI Breakthrough Released"')).toBe(false)
    expect(isIngestErrorLine('  Discarded (score 3/10): "Unrelated Story"')).toBe(false)
    expect(isIngestErrorLine("Scraped 10 articles")).toBe(false)
    expect(isIngestErrorLine('  Embedded: "AI Breakthrough Released"')).toBe(false)
    expect(isIngestErrorLine("3 new clusters (1 singletons), 2 existing clusters updated")).toBe(
      false
    )
  })

  it("does not falsely classify titles containing 'terrorism' or words with 'error' substrings as error lines", () => {
    expect(
      isIngestErrorLine(
        '  Saved: "Russia charges Telegram’s Durov with aiding terrorism and adds him to a wanted list"'
      )
    ).toBe(false)
    expect(
      isIngestErrorLine(
        '  Discarded (score 3/10): "Security report discusses counter-terrorism measures"'
      )
    ).toBe(false)
  })
})
