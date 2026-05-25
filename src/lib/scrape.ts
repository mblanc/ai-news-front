import { Readability } from "@mozilla/readability"
import { JSDOM, VirtualConsole } from "jsdom"
import TurndownService from "turndown"

export interface ExtractedContent {
  title: string
  markdown: string
  excerpt: string
  byline: string
  siteName: string
  originalUrl: string
}

export interface ScrapedArticle extends ExtractedContent {
  pubDate: Date | null
  wordCount: number
  html: string
}

export function assertSafeUrl(raw: string): void {
  const u = new URL(raw)
  if (!["http:", "https:"].includes(u.protocol)) {
    throw new Error(`Disallowed protocol: ${u.protocol}`)
  }
  const h = u.hostname
  if (
    h === "localhost" ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^169\.254\./.test(h) ||
    h === "metadata.google.internal" ||
    h.endsWith(".internal")
  ) {
    throw new Error(`Disallowed host: ${h}`)
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    url: string
  ) {
    super(`HTTP ${status} fetching ${url}`)
  }
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

// Reddit requires a descriptive User-Agent per their API rules
const REDDIT_USER_AGENT = "ai-news-aggregator/1.0 (by /u/ai-news-bot)"

function isRedditUrl(url: string): boolean {
  const { hostname } = new URL(url)
  return hostname === "reddit.com" || hostname === "www.reddit.com" || hostname === "old.reddit.com"
}

async function fetchRedditPost(url: string): Promise<ScrapedArticle> {
  // Normalise to reddit.com and append .json
  const parsed = new URL(url)
  parsed.hostname = "www.reddit.com"
  parsed.search = ""
  const jsonUrl = parsed.pathname.replace(/\/?$/, ".json")
  const apiUrl = `https://www.reddit.com${jsonUrl}`

  let response: Response
  try {
    response = await fetch(apiUrl, {
      headers: { "User-Agent": REDDIT_USER_AGENT },
    })
  } catch (error) {
    throw new Error(`Network error fetching ${apiUrl}: ${(error as Error).message}`)
  }

  if (!response.ok) {
    throw new HttpError(response.status, apiUrl)
  }

  // Reddit returns [listingPost, listingComments]
  const data = await response.json()
  const post = data?.[0]?.data?.children?.[0]?.data
  if (!post) {
    throw new Error(`Unexpected Reddit JSON structure for ${url}`)
  }

  const title: string = post.title ?? "Untitled"
  const selftext: string = post.selftext ?? ""
  const author: string = post.author ?? ""
  const subreddit: string = post.subreddit_name_prefixed ?? ""
  const score: number = post.score ?? 0
  const pubDate = post.created_utc ? new Date(post.created_utc * 1000) : null
  const externalUrl: string | undefined = post.is_self ? undefined : post.url

  let body = selftext
  if (externalUrl) {
    body = `[Original link](${externalUrl})\n\n${selftext}`
  }

  const meta = `*Posted by u/${author} in ${subreddit} · ${score} points*`
  const markdown = `# ${title}\n\n${meta}\n\n${body}`.trim()

  return {
    title,
    markdown,
    excerpt: selftext.slice(0, 200) || title,
    byline: `u/${author}`,
    siteName: "Reddit",
    originalUrl: url,
    pubDate,
    wordCount: countWords(markdown),
    html: "",
  }
}

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  hr: "---",
  bulletListMarker: "-",
})
turndown.remove(["script", "style", "iframe", "nav", "footer"])

function extractPubDate(doc: JSDOM): Date | null {
  const selectors = [
    'meta[property="article:published_time"]',
    'meta[name="article:published_time"]',
    'meta[property="datePublished"]',
    'meta[name="datePublished"]',
    'meta[itemprop="datePublished"]',
  ]
  for (const selector of selectors) {
    const content = doc.window.document.querySelector(selector)?.getAttribute("content")
    if (content) {
      const d = new Date(content)
      if (!isNaN(d.getTime())) return d
    }
  }
  return null
}

export function countWords(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[^\w\s]/g, " ")
    .trim()
  return text.split(/\s+/).filter(Boolean).length
}

export async function fetchArticle(url: string): Promise<ScrapedArticle> {
  try {
    assertSafeUrl(url)
  } catch {
    throw new Error(`Invalid URL: ${url}`)
  }

  if (isRedditUrl(url)) {
    return fetchRedditPost(url)
  }

  let response: Response
  try {
    response = await fetch(url, { headers: { "User-Agent": USER_AGENT } })
  } catch (error) {
    throw new Error(`Network error fetching ${url}: ${(error as Error).message}`)
  }

  if (!response.ok) {
    throw new HttpError(response.status, url)
  }

  const html = await response.text()
  const virtualConsole = new VirtualConsole()

  let doc: JSDOM
  try {
    doc = new JSDOM(html, { url, virtualConsole })
  } catch {
    // cssstyle throws on CSS custom properties like var(--x, fallback) — retry without URL
    // so JSDOM skips relative URL resolution and CSS cascade, which avoids the crash
    doc = new JSDOM(html, { virtualConsole })
  }

  const reader = new Readability(doc.window.document)
  const article = reader.parse()

  const pubDate = extractPubDate(doc)

  if (!article || !article.content) {
    return {
      title: "",
      markdown: "",
      excerpt: "",
      byline: "",
      siteName: "",
      originalUrl: url,
      pubDate,
      wordCount: 0,
      html,
    }
  }

  const markdownBody = turndown.turndown(article.content)
  const title = article.title || "Untitled"
  const markdown = `# ${title}\n\n${markdownBody}`

  return {
    title,
    markdown,
    excerpt: article.excerpt || "",
    byline: article.byline || "",
    siteName: article.siteName || "",
    originalUrl: url,
    pubDate,
    wordCount: countWords(markdown),
    html,
  }
}

export async function fetchAndConvertToMarkdown(url: string): Promise<ExtractedContent> {
  const result = await fetchArticle(url)
  if (!result.title) {
    throw new Error("Readability could not find any main content on the page.")
  }
  return {
    title: result.title,
    markdown: result.markdown,
    excerpt: result.excerpt,
    byline: result.byline,
    siteName: result.siteName,
    originalUrl: result.originalUrl,
  }
}
