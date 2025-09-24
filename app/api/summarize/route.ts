import { generateContent } from "@/lib/ai-utils"

export async function POST(req: Request) {
  try {
    const { articles } = await req.json()

    if (!articles || !Array.isArray(articles)) {
      return Response.json({ error: "Invalid articles data" }, { status: 400 })
    }

    const articlesText = articles
      .map(
        (article) =>
          `Title: ${article.title}\nDomain: ${article.domain}\nDate: ${new Date(article.date.seconds * 1000).toLocaleDateString()}`,
      )
      .join("\n\n")

    const prompt = `Summarize the following AI news articles. Focus on key trends, important developments, and emerging themes. Keep it concise but informative:\n\n${articlesText}`

    const text = await generateContent(prompt, 'gemini-2.5-flash', 500)

    return Response.json({ summary: text })
  } catch (error) {
    console.error("Error generating summary:", error)
    return Response.json({ error: "Failed to generate summary" }, { status: 500 })
  }
}
