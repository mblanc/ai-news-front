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

  schedule(
    "0 9 * * *",
    async () => {
      console.log("[cron] Starting scheduled daily email digest (9 AM Paris)...")
      try {
        const { sendDailyEmailDigest } = await import("@/lib/email")
        const res = await sendDailyEmailDigest()
        console.log("[cron] Daily email digest complete", JSON.stringify(res))
      } catch (err) {
        console.error("[cron] Daily email digest failed", err)
      }
    },
    { timezone: "Europe/Paris" }
  )

  console.log("[cron] Daily email digest scheduled (fires at 09:00 Paris Time)")

  // Weekly Digest + Field Overview: Every Monday at 08:00 Paris Time
  schedule(
    "0 8 * * 1",
    async () => {
      console.log("[cron] Starting scheduled weekly digest and field overview...")
      try {
        const { generateWeeklyDigest, generateAllTimeOverview } = await import("@/lib/ingest")
        await generateWeeklyDigest()
        await generateAllTimeOverview()
        console.log("[cron] Weekly digest and field overview update complete")
      } catch (err) {
        console.error("[cron] Weekly digest / field overview failed", err)
      }
    },
    { timezone: "Europe/Paris" }
  )
  console.log("[cron] Weekly digest & field overview scheduled (fires Mondays at 08:00 Paris Time)")

  // Monthly Digest: 1st day of every month at 08:00 Paris Time
  schedule(
    "0 8 1 * *",
    async () => {
      console.log("[cron] Starting scheduled monthly digest...")
      try {
        const { generateMonthlyDigest } = await import("@/lib/ingest")
        await generateMonthlyDigest()
        console.log("[cron] Monthly digest complete")
      } catch (err) {
        console.error("[cron] Monthly digest failed", err)
      }
    },
    { timezone: "Europe/Paris" }
  )
  console.log("[cron] Monthly digest scheduled (fires 1st of month at 08:00 Paris Time)")
}
