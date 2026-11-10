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

  // In development mode, check for dev role override
  if (process.env.NODE_ENV === "development") {
    const devRoleCookie = request.cookies.get("dev_role")?.value
    const roleParam = request.nextUrl.searchParams.get("role")
    const isDevUser =
      roleParam === "user" ||
      (!roleParam && (devRoleCookie === "user" || process.env.DEV_ADMIN === "false"))

    if (isDevUser) {
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
