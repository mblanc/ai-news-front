import { describe, it } from "vitest"

const url = "https://academy.dair.ai/blog"

describe("DAIR.AI blog debug", () => {
  it("fetches the page and shows raw content", async () => {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
    console.log("status:", res.status)
    console.log("content-type:", res.headers.get("content-type"))

    const html = await res.text()
    console.log("html length:", html.length)
    console.log("--- first 3000 chars ---")
    console.log(html.slice(0, 3000))
  }, 15_000)
})
