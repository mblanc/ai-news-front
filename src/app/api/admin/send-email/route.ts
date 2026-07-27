import { NextResponse } from "next/server"
import { sendDailyEmailDigest } from "@/lib/email"

export async function POST() {
  try {
    const result = await sendDailyEmailDigest()
    return NextResponse.json({
      success: true,
      message: `Daily email digest sent successfully to ${result.recipients.join(", ")}.`,
      recipients: result.recipients,
      messageId: result.messageId,
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 })
  }
}
