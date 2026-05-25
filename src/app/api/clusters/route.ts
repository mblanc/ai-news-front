import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getClusters, getClustersByDateRange } from "@/lib/firebase"

const querySchema = z.object({
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const result = querySchema.safeParse(Object.fromEntries(searchParams.entries()))

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: result.error.format() },
        { status: 400 }
      )
    }

    const { startDate, endDate } = result.data

    if (startDate && endDate) {
      return NextResponse.json(await getClustersByDateRange(new Date(startDate), new Date(endDate)))
    }

    return NextResponse.json(await getClusters())
  } catch (_error) {
    return NextResponse.json({ error: "Failed to fetch clusters" }, { status: 500 })
  }
}
