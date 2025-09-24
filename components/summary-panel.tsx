"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Loader2, X, TrendingUp } from "lucide-react"
import type { NewsItem } from "@/lib/firebase"

interface SummaryPanelProps {
  news: NewsItem[]
  selectedDomain?: string
  selectedDateRange?: { from: Date; to: Date }
}

export function SummaryPanel({ news, selectedDomain, selectedDateRange }: SummaryPanelProps) {
  const [summary, setSummary] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")

  const generateSummary = async () => {
    if (news.length === 0) return

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ articles: news }),
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

  const clearSummary = () => {
    setSummary("")
    setError("")
  }

  const getSummaryContext = () => {
    const contexts = []
    if (selectedDomain) contexts.push(`${selectedDomain} domain`)
    if (selectedDateRange) {
      contexts.push(`${selectedDateRange.from.toLocaleDateString()} - ${selectedDateRange.to.toLocaleDateString()}`)
    }
    return contexts.length > 0 ? contexts.join(" • ") : "All news"
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-playfair flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-accent" />
            AI Summary
          </CardTitle>
          {summary && (
            <Button variant="ghost" size="sm" onClick={clearSummary} className="text-muted-foreground">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {news.length} articles
          </Badge>
          <span>•</span>
          <span>{getSummaryContext()}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!summary && !isLoading && (
          <div className="text-center py-6">
            <Sparkles className="h-12 w-12 text-accent mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">Generate an AI-powered summary of the current news selection</p>
            <Button
              onClick={generateSummary}
              disabled={news.length === 0}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Summary
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto mb-3" />
            <p className="text-muted-foreground">Analyzing articles and generating summary...</p>
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
          <div className="space-y-4">
            <div className="prose prose-sm max-w-none">
              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">{summary}</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={generateSummary}
                disabled={isLoading}
                className="text-xs bg-transparent"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Regenerate
              </Button>
              <div className="text-xs text-muted-foreground">Powered by AI • {new Date().toLocaleTimeString()}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
