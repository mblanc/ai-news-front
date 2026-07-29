export function isIngestErrorLine(line: string): boolean {
  const trimmed = line.trim()

  // Progress log lines starting with these prefixes are never errors
  if (
    trimmed.startsWith("Saved:") ||
    trimmed.startsWith("Saved via") ||
    trimmed.startsWith("Relevant") ||
    trimmed.startsWith("Discarded") ||
    trimmed.startsWith("Embedded:") ||
    trimmed.startsWith("Scraped")
  ) {
    return false
  }

  return (
    trimmed.startsWith("Error") ||
    trimmed.startsWith("Fatal") ||
    /(?:^|[^a-zA-Z0-9])(?:error|fatal|failed|failure)(?:[^a-zA-Z0-9]|$)/i.test(line)
  )
}
