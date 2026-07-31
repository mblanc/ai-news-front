import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db, docToSource } from "@/lib/firebase"
import { assertSafeUrl } from "@/lib/scrape"

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  name: z
    .string()
    .transform((val) => val.trim())
    .optional(),
  url: z
    .string()
    .transform((val) => val.trim())
    .pipe(z.string().url())
    .optional(),
  type: z.enum(["rss", "page"]).optional(),
  category: z
    .enum([
      "frontier-research",
      "ai-engineering",
      "ecosystem-analysis",
      "industry-news",
      "genmedia",
    ])
    .optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const result = patchSchema.safeParse(body)
  if (!result.success) {
    console.error("PATCH /api/sources/[id] validation failed:", result.error.format())
    return NextResponse.json(
      { error: "Invalid input", details: result.error.format() },
      { status: 400 }
    )
  }

  if (result.data.url) {
    try {
      assertSafeUrl(result.data.url)
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message || "Disallowed URL" },
        { status: 422 }
      )
    }
  }

  const ref = db.collection("sources").doc(id)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await ref.update(result.data)
  const updated = await ref.get()
  return NextResponse.json(docToSource(id, updated.data()!))
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ref = db.collection("sources").doc(id)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await ref.delete()
  return new NextResponse(null, { status: 204 })
}
