import { NextRequest, NextResponse } from "next/server"
import { getLatestDigest } from "@/lib/firebase"
import type { DigestScope, SourceCategory } from "@/lib/types"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const scopeParam = searchParams.get("scope") as DigestScope | null
    const categoryParam = searchParams.get("category") as SourceCategory | "all" | null

    const validScopes: DigestScope[] = ["daily", "weekly", "monthly", "overview"]
    const validCategories: (SourceCategory | "all")[] = [
      "all",
      "frontier-research",
      "ai-engineering",
      "ecosystem-analysis",
      "industry-news",
    ]

    const scope: DigestScope = scopeParam && validScopes.includes(scopeParam) ? scopeParam : "daily"
    const category: SourceCategory | "all" =
      categoryParam && validCategories.includes(categoryParam) ? categoryParam : "all"

    const digest = await getLatestDigest(scope, category)
    if (!digest) {
      return NextResponse.json(
        { error: `No ${scope} digest available for category "${category}" yet` },
        { status: 404 }
      )
    }
    return NextResponse.json({
      ...digest,
      generatedAt: digest.generatedAt.toISOString(),
      scope,
      category,
    })
  } catch {
    return NextResponse.json({ error: "Failed to fetch digest" }, { status: 500 })
  }
}
