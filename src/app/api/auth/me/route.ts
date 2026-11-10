import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const roleParam = request.nextUrl.searchParams.get("role")
  const user = await getAuthenticatedUser(roleParam)
  const res = NextResponse.json(user)

  if (process.env.NODE_ENV === "development" && roleParam) {
    res.cookies.set("dev_role", roleParam, { path: "/" })
  }

  return res
}
