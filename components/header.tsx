"use client"
import { ModeToggle } from "@/components/mode-toggle"
import { Brain, Sparkles } from "lucide-react"

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Brain className="h-8 w-8 text-primary" />
                <Sparkles className="h-3 w-3 text-accent absolute -top-1 -right-1" />
              </div>
              <div>
                <h1 className="font-playfair font-bold text-2xl text-foreground">AI News Hub</h1>
                <p className="text-sm text-muted-foreground">Intelligent news aggregation</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
