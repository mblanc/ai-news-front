"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ExternalLink, Loader2 } from "lucide-react"
import { DomainIcon } from "@/components/domain-icon"
import { formatDateLong } from "@/lib/format-date"
import type { NewsItem } from "@/lib/firebase"

interface SummaryDialogProps {
  news: NewsItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SummaryDialog({ news, open, onOpenChange }: SummaryDialogProps) {
  const [summary, setSummary] = useState<string>("")
  const [generatedAt, setGeneratedAt] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")

  const generateSummary = async () => {
    if (!news) return
    setIsLoading(true)
    setError("")
    try {
      const response = await fetch("/api/summarize-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article: news }),
      })
      if (!response.ok) throw new Error("Failed to generate summary")
      const data = await response.json()
      setSummary(data.summary)
      setGeneratedAt(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }))
    } catch {
      setError("Failed to generate summary. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open && news) {
      setSummary("")
      setGeneratedAt("")
      setError("")
      generateSummary()
    }
  }, [open, news?.id])

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSummary("")
      setGeneratedAt("")
      setError("")
    }
    onOpenChange(newOpen)
  }

  if (!news) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto border-border bg-background p-0">
        <DialogHeader className="border-b border-border p-6 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="font-sans text-[11px] uppercase tracking-widest text-muted-foreground">
              Article Summary
            </span>
            <span className="font-sans text-[11px] text-muted-foreground flex items-center gap-1">
              <DomainIcon domain={news.domain} />
              {news.domain}
            </span>
            <span className="font-sans text-[11px] text-muted-foreground">
              {formatDateLong(news.date)}
            </span>
          </div>
          <DialogTitle className="font-newsreader text-xl leading-tight text-foreground font-normal pr-6">
            {news.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            AI-generated summary of the article from {news.domain}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5">
          <a
            href={news.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 font-sans text-sm text-muted-foreground hover:text-foreground border border-border px-4 py-2.5 bg-card hover:bg-background active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none transition-[transform,colors] duration-150"
            style={{ borderRadius: 0 }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Read full article
          </a>

          <div className="border-t border-border pt-5">
            <span className="font-sans text-[11px] uppercase tracking-widest text-muted-foreground block mb-4">
              AI Summary
            </span>

            {isLoading && (
              <div className="flex flex-col items-center py-8 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <p className="font-sans text-xs text-muted-foreground">{"Generating summary\u2026"}</p>
              </div>
            )}

            {error && !isLoading && (
              <div className="py-4">
                <p className="font-sans text-xs text-muted-foreground mb-3">{error}</p>
                <button
                  type="button"
                  onClick={generateSummary}
                  className="font-sans text-xs leading-none px-4 py-2 border border-border bg-background hover:bg-card active:bg-card active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none transition-[transform,colors] duration-150"
                  style={{ borderRadius: 0 }}
                >
                  Try again
                </button>
              </div>
            )}

            {summary && !isLoading && (
              <div className="space-y-4 animate-in fade-in-0 duration-200">
                <div className="border border-border bg-card p-4">
                  <p className="font-sans text-sm text-foreground leading-relaxed">{summary}</p>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={generateSummary}
                    disabled={isLoading}
                    className="font-sans text-xs text-muted-foreground hover:text-foreground active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed transition-[transform,colors] duration-150"
                  >
                    Regenerate
                  </button>
                  {generatedAt && (
                    <span className="font-mono text-xs text-muted-foreground">
                      Generated {generatedAt}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}