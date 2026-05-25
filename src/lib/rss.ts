import Parser from "rss-parser"
import { assertSafeUrl } from "@/lib/scrape"

export interface RssItem {
  url: string
  pubDate: Date | null
}

const parser = new Parser()

const MAX_ITEMS = 20

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
}

async function fetchFeedXml(feedUrl: string): Promise<string> {
  assertSafeUrl(feedUrl)
  const res = await fetch(feedUrl, { headers: BROWSER_HEADERS })
  if (res.ok) return res.text()

  // Firecrawl fallback for bot-protected feeds
  if (process.env.FIRECRAWL_API_KEY && (res.status === 403 || res.status === 429)) {
    const fc = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({ url: feedUrl, formats: ["rawHtml"] }),
    })
    if (fc.ok) {
      const data = await fc.json()
      const html: string = data.data?.rawHtml ?? ""
      if (html) return html
    }
  }

  throw new Error(`Failed to fetch RSS feed: HTTP ${res.status}`)
}

function parseItems(feed: Parser.Output<Record<string, unknown>>): RssItem[] {
  return feed.items
    .filter((item) => item.link)
    .slice(0, MAX_ITEMS)
    .map((item) => ({ url: item.link!, pubDate: item.isoDate ? new Date(item.isoDate) : null }))
}

export async function parseRssFeed(feedUrl: string): Promise<RssItem[]> {
  const xml = await fetchFeedXml(feedUrl)
  const feed = await parser.parseString(xml)
  return parseItems(feed)
}
