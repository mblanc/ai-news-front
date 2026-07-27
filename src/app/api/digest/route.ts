import { NextRequest, NextResponse } from "next/server"
import { getLatestDigest } from "@/lib/firebase"
import type { DigestScope } from "@/lib/types"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const scopeParam = searchParams.get("scope") as DigestScope | null
    const validScopes: DigestScope[] = ["daily", "weekly", "monthly", "overview"]
    const scope: DigestScope = scopeParam && validScopes.includes(scopeParam) ? scopeParam : "daily"

    const digest = await getLatestDigest(scope)
    if (!digest) {
      return NextResponse.json({ error: `No ${scope} digest available yet` }, { status: 404 })
    }
    return NextResponse.json({
      ...digest,
      generatedAt: digest.generatedAt.toISOString(),
      scope,
    })
  } catch {
    return NextResponse.json({ error: "Failed to fetch digest" }, { status: 500 })
  }
}
