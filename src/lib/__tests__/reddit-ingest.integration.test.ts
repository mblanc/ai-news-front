import { describe, it, expect } from "vitest"
import { parseRssFeed } from "../rss"
import { fetchArticle } from "../scrape"

describe("Reddit RSS Ingestion Integration Test", () => {
  const redditRssUrl = "https://www.reddit.com/r/singularity/top.rss?t=day"

  it("fetches and parses Reddit RSS feed items successfully", async () => {
    console.log(`Fetching Reddit RSS Feed: ${redditRssUrl}`)
    const items = await parseRssFeed(redditRssUrl)

    console.log(`Successfully parsed ${items.length} items from RSS.`)
    expect(items.length).toBeGreaterThan(0)

    const firstItem = items[0]
    console.log("First RSS Item URL:", firstItem.url)
    console.log("First RSS Item PubDate:", firstItem.pubDate)

    expect(firstItem.url).toBeDefined()
    expect(firstItem.url.startsWith("https://")).toBe(true)

    // Verify we can fetch the article content for the first item
    console.log("Attempting to fetch content for the first item URL...")
    const article = await fetchArticle(firstItem.url)

    console.log("=== Scraped Article Info ===")
    console.log("Title:    ", article.title)
    console.log("SiteName: ", article.siteName)
    console.log("Byline:   ", article.byline)
    console.log("WordCount:", article.wordCount)
    console.log("Excerpt:  ", article.excerpt)

    expect(article.title).toBeDefined()
    expect(article.title.length).toBeGreaterThan(0)
    expect(article.markdown).toBeDefined()
    expect(article.markdown.length).toBeGreaterThan(0)
  }, 30_000) // Increase timeout to 30s as fetching feeds and posts can take time
})
