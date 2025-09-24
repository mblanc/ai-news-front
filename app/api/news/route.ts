import { NextRequest, NextResponse } from "next/server"
import { getAllNews, getNewsByDomain, getNewsByDateRange, searchNews } from "@/lib/firebase"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get("domain")
    const search = searchParams.get("search")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    let news

    if (search) {
      news = await searchNews(search)
    } else if (domain) {
      news = await getNewsByDomain(domain)
    } else if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      news = await getNewsByDateRange(start, end)
    } else {
      news = await getAllNews()
    }

    return NextResponse.json(news)
  } catch (error) {
    console.error("Error fetching news:", error)
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 })
  }
}
