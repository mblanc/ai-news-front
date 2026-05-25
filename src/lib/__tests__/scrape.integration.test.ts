import { describe, it } from "vitest"
import { fetchArticle } from "../scrape"

describe("fetchArticle — Reddit", () => {
  it("scrapes a Reddit post and prints the result", async () => {
    const url =
      "https://www.reddit.com/r/accelerate/comments/1tcvy8r/what_happens_when_you_post_a_real_monet_and_say/"
    const result = await fetchArticle(url)

    console.log("=== ScrapedArticle ===")
    console.log("title:    ", result.title)
    console.log("byline:   ", result.byline)
    console.log("siteName: ", result.siteName)
    console.log("pubDate:  ", result.pubDate)
    console.log("wordCount:", result.wordCount)
    console.log("excerpt:  ", result.excerpt)
    console.log("--- markdown ---")
    console.log(result.markdown)
  }, 15_000)
})
