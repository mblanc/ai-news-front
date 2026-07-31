import { describe, it, expect, vi } from "vitest"

// Mock firebase
vi.mock("@/lib/firebase", () => {
  const mockDoc = {
    get: vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        url: "https://example.com",
        type: "rss",
        name: "Example",
        enabled: true,
        createdAt: { toDate: () => new Date() },
      }),
    }),
    update: vi.fn().mockResolvedValue({}),
  }
  return {
    db: {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDoc),
      }),
    },
    docToSource: vi.fn().mockImplementation((id, data) => ({
      id,
      ...data,
    })),
  }
})

import { PATCH } from "./route"
import { NextRequest } from "next/server"

describe("PATCH /api/sources/[id]", () => {
  it("successfully updates a source", async () => {
    const req = new NextRequest("http://localhost/api/sources/123", {
      method: "PATCH",
      body: JSON.stringify({
        name: "Updated Name",
        url: "https://updated.com",
        type: "page",
      }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "123" }) })
    expect(res.status).toBe(200)
  })

  it("returns 400 for invalid URL", async () => {
    const req = new NextRequest("http://localhost/api/sources/123", {
      method: "PATCH",
      body: JSON.stringify({
        url: "invalid-url",
      }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "123" }) })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Invalid input")
  })

  it("trims whitespace from name and URL", async () => {
    const req = new NextRequest("http://localhost/api/sources/123", {
      method: "PATCH",
      body: JSON.stringify({
        name: "  Trimmed Name  ",
        url: "  https://valid-url.com/  ",
      }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "123" }) })
    expect(res.status).toBe(200)
  })

  it("returns 422 for unsafe URL", async () => {
    const req = new NextRequest("http://localhost/api/sources/123", {
      method: "PATCH",
      body: JSON.stringify({
        url: "https://localhost/feed",
      }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "123" }) })
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error).toContain("Disallowed host")
  })

  it("allows empty name", async () => {
    const req = new NextRequest("http://localhost/api/sources/123", {
      method: "PATCH",
      body: JSON.stringify({
        name: "",
      }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "123" }) })
    expect(res.status).toBe(200)
  })

  it("updates category successfully", async () => {
    const req = new NextRequest("http://localhost/api/sources/123", {
      method: "PATCH",
      body: JSON.stringify({
        category: "frontier-research",
      }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "123" }) })
    expect(res.status).toBe(200)
  })
})
