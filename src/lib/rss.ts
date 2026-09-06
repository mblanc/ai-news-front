import Parser from "rss-parser"
import { JSDOM } from "jsdom"
import { assertSafeUrl, isRedditUrl, REDDIT_USER_AGENT, getRedditAccessToken } from "@/lib/scrape"

export interface RssItem {
  url: string
  pubDate: Date | null
}

const parser = new Parser()

const MAX_ITEMS = 20

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

let redditPromiseChain = Promise.resolve()

async function redditRateLimit(): Promise<void> {
  let resolver: () => void
  const previous = redditPromiseChain
  redditPromiseChain = new Promise((resolve) => {
    resolver = resolve
  })
  await previous
  await sleep(2500)
  resolver!()
}

export async function fetchRedditFeedViaOAuth(feedUrl: string): Promise<RssItem[] | null> {
  const token = await getRedditAccessToken().catch(() => null)
  if (!token) return null

  try {
    const parsed = new URL(feedUrl)
    const match = parsed.pathname.match(/\/r\/([^/]+)/)
    if (!match) return null

    const subreddit = match[1]
    const timeframe = parsed.searchParams.get("t") || "day"
    const apiUrl = `https://oauth.reddit.com/r/${subreddit}/top?t=${timeframe}&limit=${MAX_ITEMS}`

    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": REDDIT_USER_AGENT,
      },
    })

    if (!res.ok) return null

    const data = await res.json()
    const posts: Array<{ data?: { permalink?: string; created_utc?: number } }> =
      data?.data?.children || []
    return posts
      .filter((p) => p.data?.permalink)
      .map((p) => ({
        url: `https://www.reddit.com${p.data!.permalink}`,
        pubDate: p.data!.created_utc ? new Date(p.data!.created_utc * 1000) : null,
      }))
  } catch {
    return null
  }
}

export function sanitizeXmlEntities(xml: string): string {
  // Replace unescaped & that are not part of valid XML entities
  return xml.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;")
}

export function findRssLink(html: string, baseUrl: string): string | null {
  try {
    if (baseUrl.includes("huggingface.co/papers")) return null

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

export function extractArticleLinksFromHtml(html: string, baseUrl: string): RssItem[] {
  try {
    const dom = new JSDOM(html, { url: baseUrl })
    const doc = dom.window.document
    const origin = new URL(baseUrl).origin
    const baseHref = new URL(baseUrl).pathname.replace(/\/$/, "")

    const anchors = Array.from(doc.querySelectorAll("a[href]")) as HTMLLinkElement[]
    const seen = new Set<string>()
    const items: RssItem[] = []

    for (const a of anchors) {
      let href = a.href
      if (!href) continue
      try {
        const u = new URL(href, baseUrl)
        u.hash = ""
        href = u.toString()
      } catch {
        continue
      }

      if (seen.has(href)) continue

      const path = new URL(href).pathname
      if (
        href === baseUrl ||
        path === "/" ||
        path === baseHref ||
        path === baseHref + "/" ||
        /\/tag\//i.test(path) ||
        /\/category\//i.test(path) ||
        /\/categories\//i.test(path) ||
        /\/page\/\d+/i.test(path) ||
        /\/author\//i.test(path) ||
        /\/courses/i.test(path) ||
        /\/pricing/i.test(path) ||
        /\/login/i.test(path) ||
        /\/register/i.test(path) ||
        /\/docs/i.test(path)
      ) {
        continue
      }

      if (!href.startsWith(origin) && !baseUrl.includes("github.com")) {
        continue
      }

      if (baseUrl.includes("github.com")) {
        const parts = path.split("/").filter(Boolean)
        if (
          parts.length !== 2 ||
          [
            "features",
            "topics",
            "trending",
            "collections",
            "events",
            "sponsor",
            "login",
            "organizations",
            "about",
            "solutions",
            "resources",
            "enterprise",
            "security",
            "site",
            "pricing",
            "settings",
            "notifications",
          ].includes(parts[0]) ||
          ["stargazers", "forks", "issues", "pulls", "graphs"].includes(parts[1])
        ) {
          continue
        }
      } else if (baseUrl.includes("huggingface.co/papers")) {
        if (!path.startsWith("/papers/2")) continue
      } else if (baseUrl.includes("langchain.com")) {
        if (!path.startsWith("/blog/")) continue
      } else if (baseUrl.includes("dair.ai")) {
        if (!path.includes("/blog/")) continue
      } else if (baseUrl.includes("crewai.com")) {
        if (!path.startsWith("/blog/")) continue
      } else if (baseUrl.includes("llamaindex.ai")) {
        if (!path.startsWith("/blog/")) continue
      } else if (baseUrl.includes("deeplearning.ai")) {
        if (!path.startsWith("/the-batch/")) continue
      } else if (baseUrl.includes("ai.meta.com")) {
        if (!path.includes("/blog/")) continue
      } else if (baseUrl.includes("artificialintelligence-news.com")) {
        if (
          !path.startsWith("/news/") ||
          path.startsWith("/news/event-type/") ||
          path === "/news/videos" ||
          path === "/news/"
        )
          continue
      }

      seen.add(href)
      items.push({
        url: href,
        pubDate: null,
      })

      if (items.length >= MAX_ITEMS) break
    }

    return items
  } catch {
    return []
  }
}

let cloakBrowserQueue = Promise.resolve()

async function fetchWithCloakBrowser(feedUrl: string): Promise<string | null> {
  let unlock: () => void
  const prev = cloakBrowserQueue
  cloakBrowserQueue = new Promise((resolve) => {
    unlock = resolve
  })
  await prev

  try {
    const { launch } = await import("cloakbrowser")
    const browser = await launch({ headless: true })
    const page = await browser.newPage()
    await page.goto(feedUrl, { waitUntil: "domcontentloaded", timeout: 30000 })
    const html = await page.content()
    await browser.close()
    return html
  } catch {
    return null
  } finally {
    unlock!()
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

  // Retry on 400 Bad Request without custom User-Agent (e.g. Meta AI Blog)
  if (res && res.status === 400) {
    res = await fetch(feedUrl).catch(() => null)
  }

  // Retry on 429 (Rate Limit) with exponential backoff
  if (res && res.status === 429) {
    await sleep(4000)
    if (isRedditUrl(feedUrl)) await redditRateLimit()
    res = await fetch(feedUrl, { headers }).catch(() => null)
  }

  // Retry on 5xx Server Errors (e.g. Google blog RSS transient 500)
  if (res && res.status >= 500 && res.status < 600) {
    await sleep(2000)
    res = await fetch(feedUrl, { headers }).catch(() => null)
  }

  if (res && res.ok) {
    const text = await res.text()
    const trimmedLower = text.trimStart().toLowerCase()
    const isHtml = trimmedLower.startsWith("<!doctype html") || trimmedLower.startsWith("<html")
    return { text, isHtml }
  }

  const status = res?.status ?? "network_error"

  // CloakBrowser fallback for bot-protected feeds (403 or persistent 429)
  if (status === 403 || status === 429) {
    const html = await fetchWithCloakBrowser(feedUrl)
    if (html && html.length > 0) {
      let text = html
      const match = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)
      if (match) {
        text = match[1]
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
      }
      const trimmedLower = text.trimStart().toLowerCase()
      const isHtml = trimmedLower.startsWith("<!doctype html") || trimmedLower.startsWith("<html")
      return { text, isHtml }
    }
  }

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
        const trimmedLower = html.trimStart().toLowerCase()
        const isHtml = trimmedLower.startsWith("<!doctype html") || trimmedLower.startsWith("<html")
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
  if (isRedditUrl(feedUrl)) {
    const oauthItems = await fetchRedditFeedViaOAuth(feedUrl)
    if (oauthItems && oauthItems.length > 0) {
      return oauthItems
    }
  }

  let { text, isHtml } = await fetchFeedXml(feedUrl)

  if (isHtml) {
    // Autodiscover RSS link inside HTML
    const autodiscoveredUrl = findRssLink(text, feedUrl)
    if (autodiscoveredUrl && autodiscoveredUrl !== feedUrl) {
      try {
        const res = await fetchFeedXml(autodiscoveredUrl)
        if (!res.isHtml) {
          // Verify valid RSS XML parse
          await parser.parseString(sanitizeXmlEntities(res.text))
          text = res.text
          isHtml = false
        }
      } catch {
        // Fall back to HTML extraction
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
            await parser.parseString(sanitizeXmlEntities(res.text))
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
      const extracted = extractArticleLinksFromHtml(text, feedUrl)
      if (extracted.length > 0) {
        return extracted
      }
      throw new Error("Feed URL returned an HTML page instead of valid RSS XML")
    }
  }

  const sanitized = sanitizeXmlEntities(text)
  const feed = await parser.parseString(sanitized)
  return parseItems(feed)
}
