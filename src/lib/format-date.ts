type FirestoreTimestamp = { seconds: number; nanoseconds?: number }

function toDate(timestamp: unknown): Date | null {
  if (!timestamp) return null
  if (timestamp instanceof Date) return timestamp
  if (typeof timestamp === "object" && "seconds" in (timestamp as object)) {
    return new Date((timestamp as FirestoreTimestamp).seconds * 1000)
  }
  const d = new Date(timestamp as string | number)
  return isNaN(d.getTime()) ? null : d
}

export function formatDate(timestamp: unknown): string {
  const date = toDate(timestamp)
  if (!date) return "Unknown date"
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatDateLong(timestamp: unknown): string {
  const date = toDate(timestamp)
  if (!date) return "Unknown date"
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}
