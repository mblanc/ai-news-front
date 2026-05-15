import { generateContent } from "@/lib/ai-utils"

export async function POST(req: Request) {
  try {
    const { article } = await req.json()

    if (!article) {
      return Response.json({ error: "Invalid article data" }, { status: 400 })
    }

    console.log(article)


    const sanitize = (str: string) => str.replace(/[<>"{}]/g, "").trim()
    const safeTitle = sanitize(article.title)
    const safeDomain = sanitize(article.domain)

    const date = new Date(article.date)
    const dateStr = isNaN(date.getTime()) ? "" : date.toLocaleDateString()

    const prompt = `Provide a concise summary of the following AI news article. 
Focus on the key points, implications, and significance.

[ARTICLE_DETAILS]
Title: ${safeTitle}
Url: ${article.url}
Date: ${article.date}
[/ARTICLE_DETAILS]

Please provide a 2-3 sentence summary that captures the essence of this article.`

    const text = await generateContent(prompt, { urlContext: true });

    if (!text) {
      return Response.json({ error: "Model returned an empty response" }, { status: 500 })
    }

    return Response.json({ summary: text })
  } catch (error) {
    console.error("Error generating single article summary:", error)
    return Response.json({ error: "Failed to generate summary" }, { status: 500 })
  }
}
