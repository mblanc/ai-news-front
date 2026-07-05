import { runIngest } from "@/lib/ingest"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  const xCronSecret = req.headers.get("x-cron-secret")
  const receivedSecret = authHeader === `Bearer ${secret}` || xCronSecret === secret

  if (!secret || !receivedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const stats = await runIngest()
    return NextResponse.json({ ok: true, stats })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
