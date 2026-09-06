"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Search, X, Loader2 } from "lucide-react"

interface SearchBarProps {
  onSearch: (query: string) => void
  placeholder?: string
  defaultValue?: string
  value?: string
}

export function SearchBar({
  onSearch,
  placeholder = "Search news...",
  defaultValue = "",
  value,
}: SearchBarProps) {
  const [query, setQuery] = useState(value !== undefined ? value : defaultValue)
  const [prevValue, setPrevValue] = useState(value)
  const [isDebouncing, setIsDebouncing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  if (value !== undefined && value !== prevValue) {
    setPrevValue(value)
    setQuery(value)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName || ""
      const isInputActive = ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)

      if (e.key === "/" && !isInputActive) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      } else if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  const handleInputChange = (val: string) => {
    setQuery(val)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    setIsDebouncing(true)
    debounceTimerRef.current = setTimeout(() => {
      setIsDebouncing(false)
      onSearch(val.trim())
    }, 250)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    setIsDebouncing(false)
    onSearch(query.trim())
  }

  const handleClear = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    setIsDebouncing(false)
    setQuery("")
    onSearch("")
    inputRef.current?.focus()
  }

  return (
    <form
      role="search"
      aria-label="Search stories"
      onSubmit={handleSubmit}
      className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card p-1 shadow-xs transition-all duration-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 hover:border-border"
    >
      <div className="relative flex-1 flex items-center">
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none transition-colors" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          aria-label={placeholder}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          className="w-full h-10 sm:h-8 pl-8 pr-14 font-sans text-base sm:text-xs text-foreground bg-transparent border-0 focus:outline-none placeholder:text-muted-foreground transition-colors"
        />
        <div className="absolute right-1.5 flex items-center gap-1">
          {isDebouncing && (
            <Loader2 aria-label="Searching…" className="h-3.5 w-3.5 text-primary animate-spin" />
          )}
          {!query && !isDebouncing && (
            <kbd
              title="Press / to search"
              className="hidden sm:inline-flex items-center px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/80 bg-muted/60 border border-border/70 rounded select-none pointer-events-none"
            >
              /
            </kbd>
          )}
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={handleClear}
              className="p-2 sm:p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer flex items-center justify-center min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0"
            >
              <X className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
            </button>
          )}
        </div>
      </div>
      <button
        type="submit"
        aria-label="Search"
        className="h-10 sm:h-7 px-4 sm:px-3.5 rounded-full font-sans text-xs font-semibold text-primary-foreground bg-primary hover:opacity-95 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-all duration-150 whitespace-nowrap shadow-xs cursor-pointer flex items-center justify-center"
      >
        Search
      </button>
    </form>
  )
}
