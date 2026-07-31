import { NextRequest, NextResponse } from "next/server"
import {
  generateAndSaveDigest,
  generateWeeklyDigest,
  generateMonthlyDigest,
  generateAllTimeOverview,
  seedAllDigests,
} from "@/lib/ingest"

export async function POST(request: NextRequest) {
  try {
    const logs: string[] = []
    const log = (msg: string) => logs.push(msg)

    let scope = "daily"
    try {
      const body = await request.json()
      if (body?.scope) scope = body.scope
    } catch {
      // Body may be empty, default to daily
    }

    if (scope === "weekly") {
      await generateWeeklyDigest(log)
    } else if (scope === "monthly") {
      await generateMonthlyDigest(log)
    } else if (scope === "overview") {
      await generateAllTimeOverview(log)
    } else if (scope === "all") {
      await seedAllDigests(log)
    } else {
      await generateAndSaveDigest(log)
    }

    return NextResponse.json({
      success: true,
      message: `Digest (${scope}) generated successfully.`,
      logs,
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 })
  }
}
