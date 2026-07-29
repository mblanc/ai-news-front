import { sendDailyEmailDigest } from "@/lib/email"
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
    const result = await sendDailyEmailDigest()
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    console.error("[cron/email-digest] Error sending email digest:", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
