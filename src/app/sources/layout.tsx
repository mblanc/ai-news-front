import Link from "next/link"
import type React from "react"
import { ArrowLeft, Radio } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"

export default function SourcesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background transition-colors">
      <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-card px-2.5 py-1 font-sans text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Back to Feed</span>
            </Link>
            <div className="flex items-center gap-1.5 font-display text-xs sm:text-sm font-bold text-foreground">
              <Radio className="h-3.5 w-3.5 text-primary" />
              <span>News Sources</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ModeToggle />
          </div>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-6">
        {children}
      </main>
    </div>
  )
}
