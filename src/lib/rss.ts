import Parser from "rss-parser"
import { JSDOM } from "jsdom"
import { assertSafeUrl, isRedditUrl, REDDIT_USER_AGENT } from "@/lib/scrape"

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

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

let lastRedditFetchTimestamp = 0
async function redditRateLimit() {
  const now = Date.now()
  const elapsed = now - lastRedditFetchTimestamp
  if (elapsed < 1500) {
    await sleep(1500 - elapsed)
  }
  lastRedditFetchTimestamp = Date.now()
}

export function sanitizeXmlEntities(xml: string): string {
  // Replace unescaped & that are not part of valid XML entities
  return xml.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;")
}

export function findRssLink(html: string, baseUrl: string): string | null {
  try {
    const doc = new JSDOM(html, { url: baseUrl })
    const link = doc.window.document.querySelector<HTMLLinkElement>(
      'link[rel="alternate"][type="application/rss+xml"], link[rel="alternate"][type="application/atom+xml"]'
    )
    if (!link?.href) return null
    return link.href
  } catch {
    return null
  }
}

async function fetchFeedXml(feedUrl: string): Promise<{ text: string; isHtml: boolean }> {
  assertSafeUrl(feedUrl)
  const headers = { ...BROWSER_HEADERS }
  if (isRedditUrl(feedUrl)) {
    headers["User-Agent"] = REDDIT_USER_AGENT
    await redditRateLimit()
  }

  let res = await fetch(feedUrl, { headers }).catch(() => null)

  // Retry on 429 (Rate Limit) with backoff
  if (res && res.status === 429) {
    await sleep(2000)
    res = await fetch(feedUrl, { headers }).catch(() => null)
  }

  if (res && res.ok) {
    const text = await res.text()
    const trimmed = text.trimStart()
    const isHtml =
      trimmed.startsWith("<!DOCTYPE html") ||
      trimmed.startsWith("<html") ||
      trimmed.startsWith("<HTML")
    return { text, isHtml }
  }

  const status = res?.status ?? "network_error"

  // Firecrawl fallback for bot-protected feeds
  if (process.env.FIRECRAWL_API_KEY && (status === 403 || status === 429)) {
    const fc = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({ url: feedUrl, formats: ["rawHtml"] }),
    }).catch(() => null)
    if (fc && fc.ok) {
      const data = await fc.json()
      const html: string = data.data?.rawHtml ?? ""
      if (html) {
        const trimmed = html.trimStart()
        const isHtml = trimmed.startsWith("<!DOCTYPE html") || trimmed.startsWith("<html")
        return { text: html, isHtml }
      }
    }
  }

  throw new Error(`Failed to fetch RSS feed: HTTP ${status}`)
}

function parseItems(feed: Parser.Output<Record<string, unknown>>): RssItem[] {
  return feed.items
    .filter((item) => item.link)
    .slice(0, MAX_ITEMS)
    .map((item) => ({ url: item.link!, pubDate: item.isoDate ? new Date(item.isoDate) : null }))
}

export async function parseRssFeed(feedUrl: string): Promise<RssItem[]> {
  let { text, isHtml } = await fetchFeedXml(feedUrl)

  if (isHtml) {
    // Autodiscover RSS link inside HTML
    const autodiscoveredUrl = findRssLink(text, feedUrl)
    if (autodiscoveredUrl && autodiscoveredUrl !== feedUrl) {
      const res = await fetchFeedXml(autodiscoveredUrl)
      if (!res.isHtml) {
        text = res.text
        isHtml = false
      }
    }

    if (isHtml) {
      // Try common feed paths if autodiscovery link tag wasn't found
      const commonPaths = ["/feed", "/rss.xml", "/atom.xml", "/feed.xml", "/index.xml"]
      const origin = new URL(feedUrl).origin
      for (const path of commonPaths) {
        try {
          const candidateUrl = new URL(path, origin).toString()
          const res = await fetchFeedXml(candidateUrl)
          if (!res.isHtml) {
            text = res.text
            isHtml = false
            break
          }
        } catch {
          // Continue to next candidate path
        }
      }
    }

    if (isHtml) {
      throw new Error("Feed URL returned an HTML page instead of valid RSS XML")
    }
  }

  const sanitized = sanitizeXmlEntities(text)
  const feed = await parser.parseString(sanitized)
  return parseItems(feed)
}
