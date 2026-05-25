import { describe, it } from "vitest"
import { launch } from "cloakbrowser"

const url =
  "https://www.artificialintelligence-news.com/news/physical-ai-humanoid-robots-factories/"

describe("CloakBrowser scrape test", () => {
  it("plain fetch (403 expected)", async () => {
    const t = Date.now()
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    })
    console.log(`status: ${res.status} — ${Date.now() - t}ms`)
  }, 15_000)

  it("cloakbrowser headless", async () => {
    const t = Date.now()
    const browser = await launch({ headless: true })
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: "domcontentloaded" })
    const bodyText = await page.evaluate(() => document.body.innerText)
    await browser.close()
    console.log(`status: 200 — ${Date.now() - t}ms — body: ${bodyText.length} chars`)
  }, 60_000)
})
