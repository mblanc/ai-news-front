export function Header() {
  const today = new Date()
    .toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    .toUpperCase()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card">
      <div
        className="mx-auto flex items-center justify-between px-6"
        style={{ maxWidth: "1224px", height: "38px" }}
      >
        <h1 className="font-newsreader text-xl leading-none text-foreground">
          AI News Hub
        </h1>
        <span className="font-mono text-xs text-muted-foreground hidden sm:block">
          {today}
        </span>
      </div>
    </header>
  )
}
