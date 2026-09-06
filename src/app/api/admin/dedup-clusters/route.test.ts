import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "./route"

// Mock GoogleGenAI in cluster module
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {}
  },
}))

// Mock Firestore
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockBatchCommit = vi.fn().mockResolvedValue(undefined)
const mockBatchUpdate = vi.fn()
const mockBatchDelete = vi.fn()

const mockBatch = {
  update: mockBatchUpdate,
  delete: mockBatchDelete,
  commit: mockBatchCommit,
}

let mockDocs: Array<{ id: string; data: () => Record<string, unknown> }> = []

vi.mock("@/lib/firebase", () => ({
  db: {
    collection: vi.fn(() => ({
      orderBy: vi.fn(() => ({
        get: vi.fn().mockImplementation(async () => ({
          docs: mockDocs,
        })),
      })),
      doc: vi.fn((id: string) => ({
        id,
        update: mockUpdate,
        delete: mockDelete,
      })),
    })),
    batch: vi.fn(() => mockBatch),
  },
}))

describe("POST /api/admin/dedup-clusters", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDocs = []
  })

  it("returns message when no duplicate clusters exist", async () => {
    mockDocs = [
      {
        id: "c1",
        data: () => ({
          centroid: [1, 0],
          articles: [{ id: "a1", title: "A1" }],
          createdAt: { toMillis: () => 1000 },
        }),
      },
      {
        id: "c2",
        data: () => ({
          centroid: [0, 1], // orthogonal
          articles: [{ id: "a2", title: "A2" }],
          createdAt: { toMillis: () => 2000 },
        }),
      },
    ]

    const response = await POST()
    const data = await response.json()

    expect(data.merged).toBe(0)
    expect(data.deleted).toBe(0)
    expect(data.message).toContain("No duplicate clusters found")
    expect(mockBatchUpdate).not.toHaveBeenCalled()
  })

  it("merges duplicate clusters and strips bloated article fields", async () => {
    mockDocs = [
      {
        id: "canonical-1",
        data: () => ({
          centroid: [1, 0.01],
          articles: [
            {
              id: "art-1",
              title: "Story Canonical",
              url: "https://example.com/1",
              domain: "example.com",
              bodyMd: "Giant body md".repeat(500),
              embedding: [0.1, 0.2],
            },
          ],
          createdAt: { toMillis: () => 1000 },
        }),
      },
      {
        id: "dup-1",
        data: () => ({
          centroid: [1, 0.02], // similar to canonical-1 (sim > 0.99)
          articles: [
            {
              id: "art-2",
              title: "Story Dup",
              url: "https://example.com/2",
              domain: "example.com",
              bodyMd: "Another giant body".repeat(500),
              embedding: [0.3, 0.4],
            },
          ],
          createdAt: { toMillis: () => 2000 },
        }),
      },
    ]

    const response = await POST()
    const data = await response.json()

    expect(data.merged).toBe(1)
    expect(data.deleted).toBe(1)

    // Check batch update on canonical-1
    expect(mockBatchUpdate).toHaveBeenCalledTimes(1)
    const [updatedRef, updatePayload] = mockBatchUpdate.mock.calls[0]
    expect(updatedRef.id).toBe("canonical-1")
    expect(updatePayload.articles).toHaveLength(2)
    expect(updatePayload.articleCount).toBe(2)
    expect(updatePayload.isSingleton).toBe(false)

    // Verify bloated fields are stripped
    for (const art of updatePayload.articles) {
      expect(art.bodyMd).toBeUndefined()
      expect(art.embedding).toBeUndefined()
      expect(art.title).toBeDefined()
    }

    // Check duplicate was deleted
    expect(mockBatchDelete).toHaveBeenCalledTimes(1)
    const [deletedRef] = mockBatchDelete.mock.calls[0]
    expect(deletedRef.id).toBe("dup-1")

    expect(mockBatchCommit).toHaveBeenCalled()
  })

  it("does not merge clusters beyond the 7-day window", async () => {
    const eightDaysMs = 8 * 24 * 60 * 60 * 1000
    mockDocs = [
      {
        id: "c-old",
        data: () => ({
          centroid: [1, 0.01],
          articles: [{ id: "a1", title: "Old Story" }],
          createdAt: { toMillis: () => 1000 },
        }),
      },
      {
        id: "c-new",
        data: () => ({
          centroid: [1, 0.01], // identical embedding
          articles: [{ id: "a2", title: "New Story Months Later" }],
          createdAt: { toMillis: () => 1000 + eightDaysMs },
        }),
      },
    ]

    const response = await POST()
    const data = await response.json()

    expect(data.merged).toBe(0)
    expect(data.deleted).toBe(0)
    expect(mockBatchUpdate).not.toHaveBeenCalled()
  })
})
