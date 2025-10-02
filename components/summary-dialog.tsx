"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Loader2, ExternalLink, Calendar, Globe } from "lucide-react"
import type { NewsItem } from "@/lib/firebase"

interface SummaryDialogProps {
  news: NewsItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SummaryDialog({ news, open, onOpenChange }: SummaryDialogProps) {
  const [summary, setSummary] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")

  const generateSummary = async () => {
    if (!news) return

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/summarize-single", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ article: news }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate summary")
      }

      const data = await response.json()
      setSummary(data.summary)
    } catch (err) {
      setError("Failed to generate summary. Please try again.")
      console.error("Summary error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  // ADDED: Use useEffect to detect when the dialog opens or closes
  useEffect(() => {
    if (open) {
      // If opened, and we have news but no summary, generate it
      if (news && !summary && !isLoading) {
        console.log("Dialog opened, generating summary...")
        generateSummary()
      }
    } else {
      // If closed, reset the state for the next time
      console.log("Dialog closed, resetting state...")
      setSummary("")
      setError("")
      setIsLoading(false)
    }
    // We only want this effect to run when 'open' changes, or if the 'news' item changes while open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, news])

  const formatDate = (timestamp: any) => {
    if (timestamp?.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    }
    return "Unknown date"
  }

  if (!news) return null

  return (
    // MODIFIED: We can now pass the parent's onOpenChange directly
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-playfair text-xl leading-tight pr-8">{news.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1.5">
              <div className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                <Badge variant="secondary" className="text-xs">
                  {news.domain}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(news.date)}</span>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Article Link */}
          <Button variant="outline" asChild className="w-full bg-transparent">
            <a href={news.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Read Full Article
            </a>
          </Button>

          {/* AI Summary Section */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-accent" />
              <h3 className="font-semibold">AI Summary</h3>
            </div>

            {isLoading && (
              <div className="text-center py-6">
                <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto mb-3" />
                <p className="text-muted-foreground">Generating summary...</p>
              </div>
            )}

            {error && (
              <div className="text-center py-6">
                <div className="text-destructive text-sm mb-3">{error}</div>
                <Button variant="outline" onClick={generateSummary} size="sm">
                  Try Again
                </Button>
              </div>
            )}

            {summary && (
              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <p className="text-foreground leading-relaxed">{summary}</p>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={generateSummary} disabled={isLoading} className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Regenerate
                  </Button>
                  <div className="text-xs text-muted-foreground">Powered by AI</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}