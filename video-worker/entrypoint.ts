import { createDefaultWorkerRunnerDeps, executeWorkerTask } from "@/lib/video/worker-runner"

function getParisDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return `${get("year")}-${get("month")}-${get("day")}`
}

async function main() {
  const taskIndexRaw = process.env.CLOUD_RUN_TASK_INDEX ?? "0"
  const taskIndex = Number.parseInt(taskIndexRaw, 10)
  const dateStr = process.env.DIGEST_DATE || getParisDateString()

  console.log(`[video-worker] Starting taskIndex=${taskIndex} date=${dateStr}`)
  const doc = await executeWorkerTask({ taskIndex, dateStr }, createDefaultWorkerRunnerDeps())
  console.log(
    `[video-worker] Complete id=${doc.id} duration=${doc.durationSec.toFixed(2)}s verdict=${doc.criticVerdict}`
  )
}

main().catch((err) => {
  console.error("[video-worker] Fatal error:", err)
  process.exit(1)
})
