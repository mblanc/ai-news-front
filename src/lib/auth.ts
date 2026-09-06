import { headers } from "next/headers"

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
export async function getAuthenticatedUser(): Promise<{ email: string | null; isAdmin: boolean }> {
  const reqHeaders = await headers()
  const rawEmailHeader = reqHeaders.get("x-goog-authenticated-user-email")

  // In local development without IAP headers, default to admin for seamless local work
  if (process.env.NODE_ENV === "development" && !rawEmailHeader) {
    return { email: "dev@local", isAdmin: true }
  }

  const email = extractEmailFromIapHeader(rawEmailHeader)
  const isAdmin = isEmailAdmin(email)

  return { email, isAdmin }
}
