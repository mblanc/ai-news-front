import { NextResponse } from "next/server"
import { db, getClusterById } from "@/lib/firebase"
import { GoogleGenAI } from "@google/genai"

const INGEST_MODEL = process.env.INGEST_MODEL ?? "gemini-3.5-flash-lite"

let aiInstance: GoogleGenAI | null = null

function getAi() {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      enterprise: true,
      project: process.env.GOOGLE_CLOUD_PROJECT_ID,
      location: process.env.GOOGLE_CLOUD_LOCATION ?? "global",
    })
  }
  return aiInstance
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cluster = await getClusterById(id)
    if (!cluster) {
      return NextResponse.json({ error: "Cluster not found" }, { status: 404 })
    }

    // Fetch full body text for articles in cluster if available
    const articlesWithFullBody = await Promise.all(
      cluster.articles.map(async (a, i) => {
        let content = a.excerpt
        if (a.id) {
          try {
            const doc = await db.collection("articles").doc(a.id).get()
            if (doc.exists && doc.data()?.bodyMd) {
              content = doc.data()!.bodyMd.slice(0, 15000)
            }
          } catch {
            // fallback to excerpt
          }
        }
        return `${i + 1}. Title: ${a.title}\nSource: ${a.sourceName} (${a.domain})\nContent:\n${content}`
      })
    )

    const articleList = articlesWithFullBody.join("\n\n---\n\n")

    const prompt = `You are a world-class AI news analyst. Analyze and summarize the following AI news story for a reader who wants a thorough summary before deciding to read the full source text.

Story Articles:
${articleList}

Output JSON format:
{
  "summary": "2-3 sentence executive summary explaining what happened and why it matters.",
  "keyTakeaways": [
    "Key takeaway point 1",
    "Key takeaway point 2",
    "Key takeaway point 3"
  ],
  "whyItMatters": "Clear, direct explanation of the long-term impact or industry significance.",
  "topicTag": "${cluster.topicTag}",
  "sentiment": "${cluster.sentiment}",
  "entities": ${JSON.stringify(cluster.entities)}
}`

    const response = await getAi().models.generateContent({
      model: INGEST_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    })

    const parsed = JSON.parse(response.text ?? "{}")

    return NextResponse.json({
      summary: parsed.summary ?? cluster.summary ?? "No summary available.",
      keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
      whyItMatters: parsed.whyItMatters ?? "",
      topicTag: parsed.topicTag ?? cluster.topicTag,
      sentiment: parsed.sentiment ?? cluster.sentiment,
      entities: Array.isArray(parsed.entities) ? parsed.entities : cluster.entities,
    })
  } catch (error) {
    console.error("Error generating on-demand summary:", error)
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 })
  }
}
