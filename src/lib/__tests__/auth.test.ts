import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { extractEmailFromIapHeader, getAllowedAdminEmails, isEmailAdmin } from "@/lib/auth"

describe("auth utilities", () => {
  const originalEnv = process.env.ADMIN_EMAILS

  afterEach(() => {
    process.env.ADMIN_EMAILS = originalEnv
  })

  describe("extractEmailFromIapHeader", () => {
    it("returns null for empty or null header", () => {
      expect(extractEmailFromIapHeader(null)).toBeNull()
      expect(extractEmailFromIapHeader(undefined)).toBeNull()
      expect(extractEmailFromIapHeader("")).toBeNull()
    })

    it("strips accounts.google.com: prefix", () => {
      expect(extractEmailFromIapHeader("accounts.google.com:mblanc@google.com")).toBe(
        "mblanc@google.com"
      )
    })

    it("handles plain email and trims whitespace", () => {
      expect(extractEmailFromIapHeader("  mblanc@google.com  ")).toBe("mblanc@google.com")
    })

    it("lowercases the email address", () => {
      expect(extractEmailFromIapHeader("accounts.google.com:MBLANC@GOOGLE.COM")).toBe(
        "mblanc@google.com"
      )
    })
  })

  describe("getAllowedAdminEmails", () => {
    it("defaults to mblanc@google.com when ADMIN_EMAILS is unset", () => {
      delete process.env.ADMIN_EMAILS
      expect(getAllowedAdminEmails()).toEqual(["mblanc@google.com"])
    })

    it("parses comma-separated list from ADMIN_EMAILS", () => {
      process.env.ADMIN_EMAILS = "mblanc@google.com, other@example.com"
      expect(getAllowedAdminEmails()).toEqual(["mblanc@google.com", "other@example.com"])
    })
  })

  describe("isEmailAdmin", () => {
    beforeEach(() => {
      process.env.ADMIN_EMAILS = "mblanc@google.com"
    })

    it("returns true for exact match", () => {
      expect(isEmailAdmin("mblanc@google.com")).toBe(true)
    })

    it("returns true for case-insensitive match", () => {
      expect(isEmailAdmin("MBlanc@Google.com")).toBe(true)
    })

    it("returns false for non-admin google.com user", () => {
      expect(isEmailAdmin("colleague@google.com")).toBe(false)
    })

    it("returns false for empty or null input", () => {
      expect(isEmailAdmin(null)).toBe(false)
      expect(isEmailAdmin("")).toBe(false)
    })
  })
})
