import { NextResponse, type NextRequest } from "next/server"
import { extractEmailFromIapHeader, isEmailAdmin } from "@/lib/auth"

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const method = request.method

  const isAdminPage = pathname.startsWith("/admin")
  const isAdminApi =
    pathname.startsWith("/api/admin") ||
    pathname === "/api/ingest" ||
    (pathname.startsWith("/api/sources") && method !== "GET")

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next()
  }

  // In development mode, allow direct local access
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next()
  }

  const rawEmail = request.headers.get("x-goog-authenticated-user-email")
  const email = extractEmailFromIapHeader(rawEmail)
  const isAuthorized = isEmailAdmin(email)

  if (!isAuthorized) {
    if (isAdminPage) {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      url.search = ""
      return NextResponse.redirect(url)
    }

    return NextResponse.json({ error: "Forbidden: Admin access restricted" }, { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/ingest",
    "/api/sources/:path*",
    "/api/sources",
  ],
}
