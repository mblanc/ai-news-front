"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, ChevronDown, X } from "lucide-react"
import { format } from "date-fns"
import type { NewsItem } from "@/lib/firebase"

interface FilterPanelProps {
  news: NewsItem[]
  onFilter: (filters: FilterOptions) => void
}

export type SortOption = "date-desc" | "date-asc" | "domain-asc" | "domain-desc"

export interface FilterOptions {
  domain?: string
  dateRange?: {
    from: Date
    to: Date
  }
  sort: SortOption
}

const SORT_LABELS: Record<SortOption, string> = {
  "date-desc": "Date (newest first)",
  "date-asc": "Date (oldest first)",
  "domain-asc": "Domain (A\u2013Z)",
  "domain-desc": "Domain (Z\u2013A)",
}

export function FilterPanel({ news, onFilter }: FilterPanelProps) {
  const [filters, setFilters] = useState<FilterOptions>({ sort: "date-desc" })
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const domains = Array.from(new Set(news.map((item) => item.domain))).sort()

  useEffect(() => {
    onFilter(filters)
  }, [filters, onFilter])

  const handleDomainChange = (domain: string) => {
    setFilters((prev) => ({ ...prev, domain: domain === "all" ? undefined : domain }))
  }

  const handleDateRangeChange = (range: { from?: Date; to?: Date }) => {
    setDateRange(range)
    setFilters((prev) => ({
      ...prev,
      dateRange: range.from && range.to ? { from: range.from, to: range.to } : undefined,
    }))
  }

  const handleDatePickerOpenChange = (open: boolean) => {
    if (!open && dateRange.from && !dateRange.to) {
      setDateRange({})
      setFilters((prev) => ({ ...prev, dateRange: undefined }))
    }
    setIsDatePickerOpen(open)
  }

  const handleSortChange = (sort: SortOption) => {
    setFilters((prev) => ({ ...prev, sort }))
  }

  const clearFilters = () => {
    setFilters({ sort: "date-desc" })
    setDateRange({})
  }

  const hasActiveFilters = filters.domain || filters.dateRange
  const activeFilterCount = [filters.domain, filters.dateRange].filter(Boolean).length

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="font-sans text-[11px] uppercase tracking-widest text-muted-foreground">
            Filters
          </span>
          {activeFilterCount > 0 && (
            <span className="font-mono text-[10px] text-accent leading-none">{activeFilterCount}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="font-sans text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="filter-panel-body"
            onClick={() => setMobileOpen((o) => !o)}
            className="lg:hidden p-1 text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-150 ${mobileOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      <div
        id="filter-panel-body"
        className={`grid transition-[grid-template-rows] duration-200 ease-out lg:grid-rows-[1fr] ${mobileOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
      <div className="overflow-hidden">
      <div className="p-5 space-y-5">
        {/* Domain */}
        <div className="space-y-1.5">
          <label htmlFor="filter-domain" className="font-sans text-xs text-muted-foreground">Domain</label>
          <Select value={filters.domain || "all"} onValueChange={handleDomainChange}>
            <SelectTrigger id="filter-domain" className="bg-input border-border font-sans text-sm h-9 focus-visible:ring-accent">
              <SelectValue placeholder="All domains" />
            </SelectTrigger>
            <SelectContent className="font-sans text-sm">
              <SelectItem value="all">All domains</SelectItem>
              {domains.map((domain) => (
                <SelectItem key={domain} value={domain}>
                  {domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range */}
        <div className="space-y-1.5">
          <label htmlFor="filter-date-range" className="font-sans text-xs text-muted-foreground">Date range</label>
          <Popover open={isDatePickerOpen} onOpenChange={handleDatePickerOpenChange}>
            <PopoverTrigger asChild>
              <button
                id="filter-date-range"
                type="button"
                className="w-full h-9 flex items-center gap-2 px-3 font-sans text-sm text-foreground bg-input border border-border hover:bg-card focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none transition-colors"
                style={{ borderRadius: 0 }}
                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              >
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className={dateRange.from ? "text-foreground" : "text-muted-foreground"}>
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>{format(dateRange.from, "LLL dd, y")} \u2014 {format(dateRange.to, "LLL dd, y")}</>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    "Pick a date range"
                  )}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-[9999]" align="start" side="bottom" sideOffset={4}>
              <div className="p-4 bg-background border border-border shadow-md">
                <Calendar
                  mode="range"
                  defaultMonth={dateRange.from || new Date()}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    handleDateRangeChange(range || {})
                    if (range?.from && range?.to) handleDatePickerOpenChange(false)
                  }}
                  numberOfMonths={2}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Sort */}
        <div className="space-y-1.5">
          <label htmlFor="filter-sort" className="font-sans text-xs text-muted-foreground">Sort by</label>
          <Select value={filters.sort} onValueChange={handleSortChange}>
            <SelectTrigger id="filter-sort" className="bg-input border-border font-sans text-sm h-9 focus-visible:ring-accent">
              <SelectValue placeholder={SORT_LABELS[filters.sort]} />
            </SelectTrigger>
            <SelectContent className="font-sans text-sm">
              {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 pt-1">
            {filters.domain && (
              <span className="inline-flex items-center gap-1 font-sans text-[11px] text-foreground border border-border px-2 py-1">
                {filters.domain}
                <button
                  type="button"
                  aria-label={`Remove ${filters.domain} filter`}
                  onClick={() => handleDomainChange("all")}
                  className="p-2 -m-1 flex items-center justify-center hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
            {filters.dateRange && (
              <span className="inline-flex items-center gap-1 font-sans text-[11px] text-foreground border border-border px-2 py-1">
                Date range
                <button
                  type="button"
                  aria-label="Remove date range filter"
                  onClick={() => handleDateRangeChange({})}
                  className="p-2 -m-1 flex items-center justify-center hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>
      </div>
      </div>
    </div>
  )
}
