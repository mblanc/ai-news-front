import fetch from "node-fetch"
import Parser from "rss-parser"

const parser = new Parser()
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
}

async function testFixes() {
  console.log("=== Testing ADK Releases RSS ===")
  try {
    const res = await fetch("https://github.com/google/adk-python/releases.atom", {
      headers: BROWSER_HEADERS,
    })
    console.log(`ADK Status: ${res.status}`)
    const xml = await res.text()
    const feed = await parser.parseString(xml)
    console.log(`ADK Success! ${feed.items.length} items parsed. Title: "${feed.title}"`)
  } catch (e) {
    console.error(`ADK Error: ${e.message}`)
  }

  console.log("\n=== Testing NVIDIA Research URL (plural) ===")
  try {
    const res = await fetch("https://research.nvidia.com/publications", {
      headers: BROWSER_HEADERS,
    })
    console.log(`NVIDIA Status: ${res.status} ${res.statusText}`)
  } catch (e) {
    console.error(`NVIDIA Error: ${e.message}`)
  }

  console.log("\n=== Testing DAIR.AI Academy Feed ===")
  try {
    const res = await fetch("https://academy.dair.ai/feed", { headers: BROWSER_HEADERS })
    console.log(`DAIR.AI Feed Status: ${res.status}`)
    if (res.ok) {
      const xml = await res.text()
      const feed = await parser.parseString(xml)
      console.log(`DAIR.AI Feed Success! ${feed.items.length} items parsed.`)
    }
  } catch (e) {
    console.error(`DAIR.AI Error: ${e.message}`)
  }
}

testFixes()
