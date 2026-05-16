import type React from "react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div
          className="mx-auto flex items-center px-6"
          style={{ maxWidth: "1224px", height: "38px" }}
        >
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
            Admin
          </span>
        </div>
      </header>
      <main className="mx-auto px-6 py-8" style={{ maxWidth: "1224px" }}>
        {children}
      </main>
    </div>
  )
}
