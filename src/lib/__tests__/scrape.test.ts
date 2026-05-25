import { describe, it, expect } from "vitest"
import { countWords } from "../scrape"

describe("countWords", () => {
  it("counts plain words", () => {
    expect(countWords("hello world foo")).toBe(3)
  })

  it("ignores markdown headings", () => {
    expect(countWords("# Introduction\n\nhello world")).toBe(3)
  })

  it("ignores fenced code blocks", () => {
    expect(countWords("text\n```\nconst x = 1\n```\nmore")).toBe(2)
  })

  it("ignores inline code", () => {
    expect(countWords("use `npm install` to install")).toBe(3)
  })

  it("strips link syntax and counts link text as plain words", () => {
    // "[click here](https://example.com) for more" → "click here for more" → 4 words
    expect(countWords("[click here](https://example.com) for more")).toBe(4)
  })

  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0)
  })

  it("returns 0 for whitespace-only string", () => {
    expect(countWords("   \n\t  ")).toBe(0)
  })

  it("returns a low count for a JS-rendered shell (< 50 words threshold)", () => {
    const shell = "Loading... Please wait."
    expect(countWords(shell)).toBeLessThan(50)
  })

  it("returns >= 50 for a real article excerpt", () => {
    const excerpt = Array(55).fill("word").join(" ")
    expect(countWords(excerpt)).toBeGreaterThanOrEqual(50)
  })
})
