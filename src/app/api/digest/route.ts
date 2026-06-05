import { NextResponse } from "next/server"
import { getLatestDigest } from "@/lib/firebase"

export async function GET() {
  try {
    const digest = await getLatestDigest()
    if (!digest) {
      return NextResponse.json({ error: "No digest available yet" }, { status: 404 })
    }
    return NextResponse.json({
      ...digest,
      generatedAt: digest.generatedAt.toISOString(),
    })
  } catch {
    return NextResponse.json({ error: "Failed to fetch digest" }, { status: 500 })
  }
}
