import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db, docToSource } from "@/lib/firebase"
import { FieldValue } from "@google-cloud/firestore"
import type { SourceType } from "@/lib/types"

function detectType(url: string): SourceType {
  const lower = url.toLowerCase()
  if (/\/(feed|rss|atom)(\/|$)/.test(lower) || lower.endsWith(".xml")) {
    return "rss"
  }
  return "page"
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export async function GET() {
  const snap = await db.collection("sources").orderBy("createdAt", "desc").get()
  const sources = snap.docs.map((d) => docToSource(d.id, d.data()))
  return NextResponse.json({ sources })
}

const createSchema = z.object({
  url: z.string().url(),
  name: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const result = createSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid input", details: result.error.format() },
      { status: 400 }
    )
  }

  const { url, name } = result.data
  const doc = {
    url,
    type: detectType(url),
    name: name ?? hostnameFromUrl(url),
    enabled: true,
    createdAt: FieldValue.serverTimestamp(),
  }

  const ref = await db.collection("sources").add(doc)
  const created = await ref.get()
  return NextResponse.json(docToSource(ref.id, created.data()!), { status: 201 })
}
