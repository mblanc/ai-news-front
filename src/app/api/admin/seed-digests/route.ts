import { NextResponse } from "next/server"
import { seedAllDigests } from "@/lib/ingest"

export async function POST() {
  const logs: string[] = []
  const log = (msg: string) => {
    console.log(`[seed-digests] ${msg}`)
    logs.push(msg)
  }

  try {
    await seedAllDigests(log)
    return NextResponse.json({
      success: true,
      message: "Cold start digest seeding completed successfully across all 4 scopes.",
      logs,
    })
  } catch (err) {
    const error = (err as Error).message
    return NextResponse.json({ success: false, error, logs }, { status: 500 })
  }
}
