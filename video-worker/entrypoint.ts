import { createDefaultWorkerRunnerDeps, executeWorkerTask } from "@/lib/video/worker-runner"
import { getParisDateString } from "@/lib/video/types"

async function main() {
  const taskIndexRaw = process.env.CLOUD_RUN_TASK_INDEX ?? "0"
  const taskIndex = Number.parseInt(taskIndexRaw, 10)
  const dateStr = process.env.DIGEST_DATE || getParisDateString()

  console.log(`[video-worker] Starting taskIndex=${taskIndex} date=${dateStr}`)
  const doc = await executeWorkerTask({ taskIndex, dateStr }, createDefaultWorkerRunnerDeps())
  const costSummary = doc.cost
    ? ` cost=$${doc.cost.totalUsd.toFixed(4)} (llm=$${doc.cost.llmUsd.toFixed(4)} tts=$${doc.cost.ttsUsd.toFixed(4)} compute=$${doc.cost.computeUsd.toFixed(4)})`
    : ""
  console.log(
    `[video-worker] Complete id=${doc.id} duration=${doc.durationSec.toFixed(2)}s verdict=${doc.criticVerdict}${costSummary}`
  )
}

main().catch((err) => {
  console.error("[video-worker] Fatal error:", err)
  process.exit(1)
})
