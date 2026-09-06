import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { middleware } from "@/middleware"

describe("Next.js middleware route protection", () => {
  const originalEnv = process.env.NODE_ENV
  const originalAdmins = process.env.ADMIN_EMAILS

  beforeEach(() => {
    // Simulate production environment
    ;(process.env as Record<string, string>).NODE_ENV = "production"
    process.env.ADMIN_EMAILS = "mblanc@google.com"
  })

  afterEach(() => {
    ;(process.env as Record<string, string>).NODE_ENV = originalEnv
    process.env.ADMIN_EMAILS = originalAdmins
  })

  it("allows public requests to home and clusters without credentials", () => {
    const req = new NextRequest("https://news.example.com/")
    const res = middleware(req)
    // When middleware allows a request through without redirect/response, it returns NextURL or NextResponse with status 200
    expect(res.status).toBe(200)
    expect(res.headers.get("location")).toBeNull()
  })

  it("allows public GET /api/sources without credentials", () => {
    const req = new NextRequest("https://news.example.com/api/sources", { method: "GET" })
    const res = middleware(req)
    expect(res.status).toBe(200)
    expect(res.headers.get("location")).toBeNull()
  })

  it("redirects unauthorized access on /admin to /", () => {
    const req = new NextRequest("https://news.example.com/admin")
    const res = middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("https://news.example.com/")
  })

  it("redirects unauthorized access with different google.com email", () => {
    const req = new NextRequest("https://news.example.com/admin", {
      headers: {
        "x-goog-authenticated-user-email": "accounts.google.com:colleague@google.com",
      },
    })
    const res = middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("https://news.example.com/")
  })

  it("allows /admin for mblanc@google.com", () => {
    const req = new NextRequest("https://news.example.com/admin", {
      headers: {
        "x-goog-authenticated-user-email": "accounts.google.com:mblanc@google.com",
      },
    })
    const res = middleware(req)
    expect(res.status).toBe(200)
    expect(res.headers.get("location")).toBeNull()
  })

  it("blocks unauthorized POST to /api/admin/generate-digest with 403", async () => {
    const req = new NextRequest("https://news.example.com/api/admin/generate-digest", {
      method: "POST",
      headers: {
        "x-goog-authenticated-user-email": "accounts.google.com:colleague@google.com",
      },
    })
    const res = middleware(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/Forbidden/)
  })

  it("blocks unauthorized POST to /api/ingest with 403", async () => {
    const req = new NextRequest("https://news.example.com/api/ingest", {
      method: "POST",
    })
    const res = middleware(req)
    expect(res.status).toBe(403)
  })

  it("allows authorized POST to /api/ingest for mblanc@google.com", () => {
    const req = new NextRequest("https://news.example.com/api/ingest", {
      method: "POST",
      headers: {
        "x-goog-authenticated-user-email": "accounts.google.com:mblanc@google.com",
      },
    })
    const res = middleware(req)
    expect(res.status).toBe(200)
  })

  it("blocks unauthorized mutating POST to /api/sources", async () => {
    const req = new NextRequest("https://news.example.com/api/sources", {
      method: "POST",
    })
    const res = middleware(req)
    expect(res.status).toBe(403)
  })

  it("allows mutating POST to /api/sources for mblanc@google.com", () => {
    const req = new NextRequest("https://news.example.com/api/sources", {
      method: "POST",
      headers: {
        "x-goog-authenticated-user-email": "accounts.google.com:mblanc@google.com",
      },
    })
    const res = middleware(req)
    expect(res.status).toBe(200)
  })
})
