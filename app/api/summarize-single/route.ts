import { generateContent } from "@/lib/ai-utils"

export async function POST(req: Request) {
  try {
    const { article } = await req.json()

    if (!article) {
      return Response.json({ error: "Invalid article data" }, { status: 400 })
    }

    console.log(article)


    const prompt = `Provide a concise summary of this AI news article. Focus on the key points, implications, and significance:

Title: ${article.title}
Url: ${article.url}
Date: ${article.date}

Please provide a 2-3 sentence summary that captures the essence of this article.`

    console.log(prompt)

    const text = await generateContent(prompt, { urlContext: true });

    return Response.json({ summary: text })
  } catch (error) {
    console.error("Error generating single article summary:", error)
    return Response.json({ error: "Failed to generate summary" }, { status: 500 })
  }
}
