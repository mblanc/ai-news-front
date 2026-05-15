import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  getAllNews,
  getNewsByDay,
  getNewsByDomain,
  getNewsByDateRange,
  searchNews,
  getNewsBefore,
} from "@/lib/firebase"

const querySchema = z.object({
  domain: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  date: z.string().optional(),
  before: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().positive().default(20),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const result = querySchema.safeParse(Object.fromEntries(searchParams.entries()))

    if (!result.success) {
      return NextResponse.json({ error: "Invalid query parameters", details: result.error.format() }, { status: 400 })
    }

    const { domain, search, startDate, endDate, date, before, limit } = result.data

    if (search) {
      return NextResponse.json(await searchNews(search, limit))
    }

    if (domain) {
      return NextResponse.json(await getNewsByDomain(domain))
    }

    if (startDate && endDate) {
      return NextResponse.json(await getNewsByDateRange(new Date(startDate), new Date(endDate)))
    }

    if (date) {
      const parsedDate = new Date(date)
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
      }
      return NextResponse.json(await getNewsByDay(parsedDate))
    }

    if (before) {
      return NextResponse.json(await getNewsBefore(new Date(before), limit))
    }

    return NextResponse.json(await getAllNews())
  } catch (error) {
    console.error("Error fetching news:", error)
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 })
  }
}
