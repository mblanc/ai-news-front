import { type NextRequest, NextResponse } from "next/server"
import {
  generateAndSaveDigest,
  generateWeeklyDigest,
  generateMonthlyDigest,
  generateAllTimeOverview,
  seedAllDigests,
} from "@/lib/ingest"

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  const xCronSecret = req.headers.get("x-cron-secret")
  const receivedSecret = authHeader === `Bearer ${secret}` || xCronSecret === secret

  if (!secret || !receivedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const logs: string[] = []
  const log = (msg: string) => logs.push(msg)

  try {
    const scope = req.nextUrl.searchParams.get("scope") || "daily"

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

    return NextResponse.json({ ok: true, scope, logs })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message, logs }, { status: 500 })
  }
}
