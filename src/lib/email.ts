import nodemailer from "nodemailer"
import { getLatestDigest, getClustersByDateRange } from "@/lib/firebase"
import type { Digest, Cluster, GroundedInsight } from "@/lib/types"

export function renderDigestHtml(digest: Digest | null, clusters: Cluster[]): string {
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Europe/Paris",
  })

  let insightsHtml = ""
  if (digest && digest.insights.length > 0) {
    insightsHtml = digest.insights
      .map((item) => {
        if (typeof item === "string") {
          return `<li style="margin-bottom: 12px; line-height: 1.5; color: #334155;">${item}</li>`
        }
        const insight = item as GroundedInsight
        const sourcesHtml =
          insight.sources.length > 0
            ? `<div style="margin-top: 4px; font-size: 12px; color: #64748b;">
                Sources: ${insight.sources
                  .map(
                    (s) =>
                      `<a href="${s.url}" style="color: #2563eb; text-decoration: underline;" target="_blank">${
                        s.title || s.domain
                      }</a>`
                  )
                  .join(", ")}
              </div>`
            : ""

        return `<li style="margin-bottom: 12px; line-height: 1.5; color: #334155;">
          <div>${insight.text}</div>
          ${sourcesHtml}
        </li>`
      })
      .join("")
  } else {
    insightsHtml = `<li style="color: #64748b; font-style: italic;">No AI synthesis digest available for today.</li>`
  }

  let clustersHtml = ""
  if (clusters.length > 0) {
    clustersHtml = clusters
      .slice(0, 15)
      .map((c) => {
        const articleCountLabel =
          c.articleCount > 1
            ? `<span style="font-size: 11px; color: #64748b; margin-left: 6px;">(${c.articleCount} sources)</span>`
            : ""
        const tagLabel = c.topicTag
          ? `<span style="display: inline-block; background-color: #f1f5f9; color: #475569; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; margin-bottom: 6px;">${c.topicTag}</span>`
          : ""

        const articleLinks = (c.articles || [])
          .slice(0, 3)
          .map(
            (a) =>
              `<a href="${a.url}" style="color: #2563eb; text-decoration: none; font-size: 13px;" target="_blank">${
                a.title || a.url
              }</a> <span style="font-size: 11px; color: #94a3b8;">(${a.sourceName || a.domain})</span>`
          )
          .join(" • ")

        return `<div style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; background-color: #ffffff;">
          ${tagLabel}
          <div style="font-size: 14px; font-weight: 500; color: #0f172a; line-height: 1.4; margin-bottom: 8px;">
            ${c.summary} ${articleCountLabel}
          </div>
          <div style="font-size: 13px; color: #64748b;">
            ${articleLinks}
          </div>
        </div>`
      })
      .join("")
  } else {
    clustersHtml = `<p style="color: #64748b; font-style: italic;">No new stories recorded in the past 24 hours.</p>`
  }

  const headlineText = digest?.headline || "Daily AI News Briefing"

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headlineText}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
  <div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    
    <!-- Header -->
    <div style="background-color: #0f172a; padding: 24px; color: #ffffff;">
      <div style="font-size: 11px; font-weight: 700; tracking: 0.1em; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px;">AI Daily Pulse</div>
      <h1 style="margin: 0; font-size: 20px; font-weight: 600; line-height: 1.3;">${headlineText}</h1>
      <div style="font-size: 12px; color: #64748b; margin-top: 8px;">${dateStr}</div>
    </div>

    <div style="padding: 24px;">
      <!-- Key Insights Section -->
      <div style="margin-bottom: 28px;">
        <h2 style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">Key Strategic Insights</h2>
        <ul style="padding-left: 20px; margin: 0;">
          ${insightsHtml}
        </ul>
      </div>

      <!-- Past 24h Top Stories Section -->
      <div>
        <h2 style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">Past 24 Hours Top Stories</h2>
        ${clustersHtml}
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
      Sent automatically by AI Daily Pulse at 09:00 Paris Time.
    </div>
  </div>
</body>
</html>`
}

export function renderDigestText(digest: Digest | null, clusters: Cluster[]): string {
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Europe/Paris",
  })

  let text = `AI DAILY PULSE — ${dateStr}\n`
  text += `====================================================\n\n`

  if (digest?.headline) {
    text += `HEADLINE:\n${digest.headline}\n\n`
  }

  text += `KEY STRATEGIC INSIGHTS:\n`
  if (digest && digest.insights.length > 0) {
    digest.insights.forEach((item, idx) => {
      if (typeof item === "string") {
        text += `${idx + 1}. ${item}\n\n`
      } else {
        const insight = item as GroundedInsight
        text += `${idx + 1}. ${insight.text}\n`
        if (insight.sources.length > 0) {
          text += `   Sources: ${insight.sources.map((s) => `${s.title} (${s.url})`).join(", ")}\n`
        }
        text += `\n`
      }
    })
  } else {
    text += `No digest available today.\n\n`
  }

  text += `====================================================\n`
  text += `PAST 24 HOURS TOP STORIES:\n\n`

  if (clusters.length > 0) {
    clusters.slice(0, 15).forEach((c, idx) => {
      const tag = (c.topicTag || "other").toUpperCase()
      text += `[${idx + 1}] [${tag}] ${c.summary}\n`
      if (c.articles && c.articles.length > 0) {
        c.articles.slice(0, 3).forEach((a) => {
          text += `    • ${a.title || a.url} (${a.url})\n`
        })
      }
      text += `\n`
    })
  } else {
    text += `No new stories in the past 24 hours.\n`
  }

  text += `\nSent automatically by AI Daily Pulse.`
  return text
}

export async function sendDailyEmailDigest(): Promise<{
  success: boolean
  recipients: string[]
  messageId?: string
}> {
  const rawRecipients = process.env.DIGEST_RECIPIENTS || ""
  const recipients = rawRecipients
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0)

  if (recipients.length === 0) {
    throw new Error("No recipients configured in DIGEST_RECIPIENTS environment variable.")
  }

  const digest = await getLatestDigest()
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const clusters = await getClustersByDateRange(yesterday, now)

  const html = renderDigestHtml(digest, clusters)
  const text = renderDigestText(digest, clusters)

  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com"
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10)
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS

  if (!smtpUser || !smtpPass) {
    throw new Error("Missing SMTP credentials (SMTP_USER or SMTP_PASS environment variables).")
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })

  const fromAddress = process.env.EMAIL_FROM || `AI Daily Pulse <${smtpUser}>`
  const subject = digest?.headline
    ? `⚡ AI Digest: ${digest.headline}`
    : `⚡ AI News Daily Digest — ${now.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}`

  const info = await transporter.sendMail({
    from: fromAddress,
    to: recipients.join(", "),
    subject,
    text,
    html,
    headers: {
      "List-Unsubscribe": `<mailto:${smtpUser}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  })

  return {
    success: true,
    recipients,
    messageId: info.messageId,
  }
}
