"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Sparkles, Shield } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"

export function Header() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.isAdmin) {
          setIsAdmin(true)
        }
      })
      .catch(() => {
        // Silently fail to false
      })
  }, [])

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/95 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link
          href="/"
          className="group flex items-center gap-2 text-foreground hover:text-primary transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-sm font-bold tracking-tight leading-none text-foreground group-hover:text-primary transition-colors">
              AI News Hub
            </span>
            <span className="font-sans text-[10px] font-medium text-muted-foreground leading-none mt-0.5 tracking-wide">
              Agentic Synthesis
            </span>
          </div>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center rounded-full bg-muted/60 px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground border border-border/60">
            {today}
          </span>

          {isAdmin && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 sm:px-2.5 sm:py-1 font-sans text-xs font-medium text-foreground hover:border-primary hover:text-primary transition-all shadow-xs min-h-[36px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              <Shield className="h-3.5 w-3.5 sm:h-3 sm:w-3 text-primary" />
              <span>Admin</span>
            </Link>
          )}

          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
