import { describe, it, expect } from "vitest"
import { sha256 } from "../hash"

describe("sha256", () => {
  it("returns a 64-character hex string", () => {
    const result = sha256("hello")
    expect(result).toHaveLength(64)
    expect(result).toMatch(/^[0-9a-f]+$/)
  })

  it("is deterministic — same input always produces same output", () => {
    const url = "https://example.com/article/123"
    expect(sha256(url)).toBe(sha256(url))
  })

  it("produces different hashes for different inputs", () => {
    expect(sha256("https://a.com")).not.toBe(sha256("https://b.com"))
  })

  it("handles empty string", () => {
    const result = sha256("")
    expect(result).toHaveLength(64)
  })

  it("produces the known SHA-256 of 'hello'", () => {
    expect(sha256("hello")).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824")
  })
})
