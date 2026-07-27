export function isIngestErrorLine(line: string): boolean {
  const trimmed = line.trim()
  return (
    trimmed.startsWith("Error") ||
    trimmed.startsWith("Fatal") ||
    /(?:error|fatal|failed|failure)/i.test(line)
  )
}
