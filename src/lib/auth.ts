import { headers, cookies } from "next/headers"

export const DEFAULT_ADMIN_EMAILS = ["mblanc@google.com"]

/**
 * Extracts and normalizes the email address from Cloud Run / App Engine IAP header.
 * Google IAP passes headers like: "accounts.google.com:mblanc@google.com"
 */
export function extractEmailFromIapHeader(rawHeader: string | null | undefined): string | null {
  if (!rawHeader) return null
  const cleaned = rawHeader
    .replace(/^accounts\.google\.com:/, "")
    .trim()
    .toLowerCase()
  return cleaned || null
}

/**
 * Returns the list of configured admin emails.
 */
export function getAllowedAdminEmails(): string[] {
  const envAdmins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  return envAdmins.length > 0 ? envAdmins : DEFAULT_ADMIN_EMAILS
}

/**
 * Checks if a given email is in the admin allowlist.
 */
export function isEmailAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const allowed = getAllowedAdminEmails()
  return allowed.includes(email.toLowerCase().trim())
}

/**
 * Helper for Server Components and Route Handlers to get current user identity.
 */
export async function getAuthenticatedUser(
  overrideRole?: string | null
): Promise<{ email: string | null; isAdmin: boolean }> {
  const reqHeaders = await headers()
  const rawEmailHeader = reqHeaders.get("x-goog-authenticated-user-email")

  // In local development without IAP headers, allow role customization
  if (process.env.NODE_ENV === "development" && !rawEmailHeader) {
    if (overrideRole === "user") {
      return { email: "user@local", isAdmin: false }
    }
    if (overrideRole === "admin") {
      return { email: "dev@local", isAdmin: true }
    }

    if (process.env.DEV_ADMIN === "false") {
      return { email: "user@local", isAdmin: false }
    }

    try {
      const cookieStore = await cookies()
      const devRole = cookieStore.get("dev_role")?.value
      if (devRole === "user") {
        return { email: "user@local", isAdmin: false }
      }
    } catch {
      // Cookies not available in this context
    }

    return { email: "dev@local", isAdmin: true }
  }

  const email = extractEmailFromIapHeader(rawEmailHeader)
  const isAdmin = isEmailAdmin(email)

  return { email, isAdmin }
}
