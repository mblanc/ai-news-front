import { type NextRequest, NextResponse } from "next/server"
import {
  triggerVideoWorkerJob,
  type TriggerVideoWorkerOptions,
  type TriggerVideoWorkerResult,
} from "@/lib/video/cloud-run-jobs"

const DATE_PARAM_RE = /^\d{4}-\d{2}-\d{2}$/

export interface CronVideoDeps {
  cronSecret?: string
  triggerJob?: (options: TriggerVideoWorkerOptions) => Promise<TriggerVideoWorkerResult>
}

export async function handleCronVideoRequest(req: NextRequest, deps: CronVideoDeps = {}) {
  const secret = deps.cronSecret ?? process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  const xCronSecret = req.headers.get("x-cron-secret")
  const authorized =
    Boolean(secret) && (authHeader === `Bearer ${secret}` || xCronSecret === secret)

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dateParam = req.nextUrl.searchParams.get("date") ?? undefined
  if (dateParam && !DATE_PARAM_RE.test(dateParam)) {
    return NextResponse.json(
      { error: "Invalid date parameter; expected YYYY-MM-DD" },
      { status: 400 }
    )
  }

  try {
    const triggerJob = deps.triggerJob ?? ((opts) => triggerVideoWorkerJob(opts))
    const result = await triggerJob({ dateStr: dateParam })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return handleCronVideoRequest(req)
}
