import { NextResponse } from "next/server"
import { generateAndSaveDigest } from "@/lib/ingest"

export async function POST() {
  try {
    const logs: string[] = []
    await generateAndSaveDigest((msg) => logs.push(msg))
    return NextResponse.json({
      success: true,
      message: "Daily digest generated successfully.",
      logs,
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 })
  }
}
