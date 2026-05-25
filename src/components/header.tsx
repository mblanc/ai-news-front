import Link from "next/link"

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
        <Link
          href="/"
          className="font-newsreader text-xl leading-none text-foreground hover:text-muted-foreground transition-colors"
        >
          AI News Hub
        </Link>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-muted-foreground hidden sm:block">{today}</span>
          <Link
            href="/admin"
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors border border-border px-2 py-0.5"
          >
            Admin
          </Link>
        </div>
      </div>
    </header>
  )
}
