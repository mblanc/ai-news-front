"use client"

import type React from "react"
import { useState } from "react"
import { Search, X } from "lucide-react"

interface SearchBarProps {
  onSearch: (query: string) => void
  placeholder?: string
  defaultValue?: string
}

export function SearchBar({ onSearch, placeholder = "Search news...", defaultValue = "" }: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(query.trim())
  }

  const handleClear = () => {
    setQuery("")
    onSearch("")
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-stretch">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-10 pl-10 pr-9 font-sans text-sm text-foreground bg-input border border-border border-r-0 focus:outline-none focus:border-accent placeholder:text-muted-foreground transition-colors"
          style={{ borderRadius: 0 }}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <button
        type="submit"
        aria-label="Search"
        className="h-10 px-6 font-sans text-xs text-foreground bg-background border border-border hover:bg-card active:bg-card focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none transition-colors whitespace-nowrap"
        style={{ borderRadius: 0 }}
      >
        Search
      </button>
    </form>
  )
}
