import { generateContent } from "@/lib/ai-utils"

export async function POST(req: Request) {
  try {
    const { article } = await req.json()

    if (!article) {
      return Response.json({ error: "Invalid article data" }, { status: 400 })
    }

    const prompt = `Provide a concise summary of this AI news article. Focus on the key points, implications, and significance:

Title: ${article.title}
Domain: ${article.domain}
Date: ${new Date(article.date.seconds * 1000).toLocaleDateString()}

Please provide a 2-3 sentence summary that captures the essence of this article.`

    const text = await generateContent(prompt)

    return Response.json({ summary: text })
  } catch (error) {
    console.error("Error generating single article summary:", error)
    return Response.json({ error: "Failed to generate summary" }, { status: 500 })
  }
}
