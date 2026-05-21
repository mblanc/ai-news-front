export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { schedule } = await import("node-cron")
  const { runIngest } = await import("@/lib/ingest")

  let running = false

  schedule("0 * * * *", async () => {
    if (running) {
      console.log("[cron] Skipping ingest — previous run still in progress")
      return
    }
    running = true
    try {
      console.log("[cron] Starting scheduled ingest")
      const stats = await runIngest()
      console.log("[cron] Ingest complete", JSON.stringify(stats))
    } catch (err) {
      console.error("[cron] Ingest failed", err)
    } finally {
      running = false
    }
  })

  console.log("[cron] Hourly ingest scheduled (fires at :00 each hour)")
}
