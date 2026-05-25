import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock rss-parser before importing the module under test
vi.mock("rss-parser", () => {
  return {
    default: class MockParser {
      async parseString(_xml: string) {
        return { items: mockItems }
      }
    },
  }
})

// Prevent real network calls — the implementation fetches the XML before parsing
vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("<rss></rss>") })
)

import { parseRssFeed } from "../rss"

const now = new Date()

function daysAgo(n: number): Date {
  const d = new Date(now)
  d.setDate(d.getDate() - n)
  return d
}

let mockItems: Array<{ link?: string; isoDate?: string }> = []

beforeEach(() => {
  mockItems = []
})

describe("parseRssFeed", () => {
  it("returns all items regardless of age (caller is responsible for date filtering)", async () => {
    mockItems = [
      { link: "https://example.com/new", isoDate: daysAgo(1).toISOString() },
      { link: "https://example.com/old", isoDate: daysAgo(5).toISOString() },
    ]
    const items = await parseRssFeed("https://feed.example.com/rss")
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.url)).toContain("https://example.com/new")
    expect(items.map((i) => i.url)).toContain("https://example.com/old")
  })

  it("includes items with no pubDate (age unknown — keep them)", async () => {
    mockItems = [{ link: "https://example.com/no-date" }]
    const items = await parseRssFeed("https://feed.example.com/rss")
    expect(items).toHaveLength(1)
    expect(items[0].pubDate).toBeNull()
  })

  it("skips items with no link", async () => {
    mockItems = [
      { isoDate: daysAgo(1).toISOString() }, // no link
      { link: "https://example.com/ok", isoDate: daysAgo(1).toISOString() },
    ]
    const items = await parseRssFeed("https://feed.example.com/rss")
    expect(items).toHaveLength(1)
    expect(items[0].url).toBe("https://example.com/ok")
  })

  it("caps at 20 items even when more are available", async () => {
    mockItems = Array.from({ length: 30 }, (_, i) => ({
      link: `https://example.com/${i}`,
      isoDate: daysAgo(1).toISOString(),
    }))
    const items = await parseRssFeed("https://feed.example.com/rss")
    expect(items).toHaveLength(20)
  })

  it("returns old items too — date filtering is the caller's responsibility", async () => {
    mockItems = [
      { link: "https://example.com/a", isoDate: daysAgo(4).toISOString() },
      { link: "https://example.com/b", isoDate: daysAgo(10).toISOString() },
    ]
    const items = await parseRssFeed("https://feed.example.com/rss")
    expect(items).toHaveLength(2)
  })

  it("returns empty array when feed has no items", async () => {
    mockItems = []
    const items = await parseRssFeed("https://feed.example.com/rss")
    expect(items).toHaveLength(0)
  })

  it("populates pubDate correctly for items that have one", async () => {
    const date = daysAgo(1)
    mockItems = [{ link: "https://example.com/x", isoDate: date.toISOString() }]
    const items = await parseRssFeed("https://feed.example.com/rss")
    expect(items[0].pubDate).toBeInstanceOf(Date)
    expect(Math.abs(items[0].pubDate!.getTime() - date.getTime())).toBeLessThan(1000)
  })
})
