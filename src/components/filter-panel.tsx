"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CalendarIcon, ChevronDown, Search, X } from "lucide-react"
import { format } from "date-fns"
import type { SourceCategory } from "@/lib/types"

export interface SourceOption {
  id: string
  name: string
  category?: SourceCategory
}

interface FilterPanelProps {
  sources: SourceOption[]
  onFilter: (filters: FilterOptions) => void
}

export type SortOption = "date-desc" | "date-asc" | "domain-asc" | "domain-desc"

export interface FilterOptions {
  category?: SourceCategory | "all"
  sourceIds?: string[]
  sourceId?: string
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

const CATEGORY_OPTIONS: Array<{ value: SourceCategory | "all"; label: string }> = [
  { value: "all", label: "🌐 State of AI (All)" },
  { value: "industry-news", label: "🏢 Industry News" },
  { value: "ai-engineering", label: "🛠️ AI Engineering" },
  { value: "frontier-research", label: "🧪 Frontier R&D" },
  { value: "genmedia", label: "🎨 GenMedia" },
  { value: "ecosystem-analysis", label: "📰 Ecosystem Analysis" },
]

export function FilterPanel({ sources, onFilter }: FilterPanelProps) {
  const [filters, setFilters] = useState<FilterOptions>({ sort: "date-desc", category: "all" })
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [isSourcePickerOpen, setIsSourcePickerOpen] = useState(false)
  const [sourceSearch, setSourceSearch] = useState("")
  const [mobileOpen, setMobileOpen] = useState(false)

  const sortedSources = [...sources].sort((a, b) => a.name.localeCompare(b.name))
  const filteredSourcesList = sortedSources.filter((s) =>
    s.name.toLowerCase().includes(sourceSearch.toLowerCase())
  )

  useEffect(() => {
    onFilter(filters)
  }, [filters, onFilter])

  const handleCategoryChange = (val: string) => {
    setFilters((prev) => ({ ...prev, category: val as SourceCategory | "all" }))
  }

  const toggleSourceId = (id: string) => {
    setFilters((prev) => {
      const current = prev.sourceIds || []
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
      return { ...prev, sourceIds: next.length > 0 ? next : undefined }
    })
  }

  const handleSelectAllSources = () => {
    setFilters((prev) => ({
      ...prev,
      sourceIds: sortedSources.map((s) => s.id),
    }))
  }

  const handleClearSources = () => {
    setFilters((prev) => ({ ...prev, sourceIds: undefined, sourceId: undefined }))
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
    setFilters({ sort: "date-desc", category: "all" })
    setDateRange({})
  }

  const selectedSourceCount = filters.sourceIds?.length ?? (filters.sourceId ? 1 : 0)
  const isCategoryFiltered = filters.category && filters.category !== "all"
  const hasActiveFilters = isCategoryFiltered || selectedSourceCount > 0 || filters.dateRange
  const activeFilterCount = [isCategoryFiltered, selectedSourceCount > 0, filters.dateRange].filter(
    Boolean
  ).length

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="font-sans text-[11px] uppercase tracking-widest text-muted-foreground">
            Filters
          </span>
          {activeFilterCount > 0 && (
            <span className="font-mono text-[10px] text-accent leading-none">
              {activeFilterCount}
            </span>
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
            {/* Category Filter */}
            <div className="space-y-1.5">
              <label htmlFor="filter-category" className="font-sans text-xs text-muted-foreground">
                Category
              </label>
              <Select value={filters.category || "all"} onValueChange={handleCategoryChange}>
                <SelectTrigger
                  id="filter-category"
                  className="bg-input border-border font-sans text-sm h-9 focus-visible:ring-accent"
                >
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="font-sans text-sm">
                  {CATEGORY_OPTIONS.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Multi-Choice Sources Filter */}
            <div className="space-y-1.5">
              <label htmlFor="filter-sources" className="font-sans text-xs text-muted-foreground">
                Sources ({selectedSourceCount > 0 ? `${selectedSourceCount} selected` : "All"})
              </label>
              <Popover open={isSourcePickerOpen} onOpenChange={setIsSourcePickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    id="filter-sources"
                    type="button"
                    className="w-full h-9 flex items-center justify-between px-3 font-sans text-sm text-foreground bg-input border border-border hover:bg-card focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none transition-colors"
                  >
                    <span className="truncate">
                      {selectedSourceCount === 0
                        ? "All sources"
                        : selectedSourceCount === 1
                          ? (sources.find(
                              (s) => s.id === (filters.sourceIds?.[0] ?? filters.sourceId)
                            )?.name ?? "1 source")
                          : `${selectedSourceCount} sources selected`}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0 z-[9999]" align="start" sideOffset={4}>
                  <div className="p-3 bg-background border border-border shadow-md space-y-2">
                    <div className="flex items-center gap-2 border border-border bg-input px-2.5 py-1.5">
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        type="text"
                        placeholder="Search sources…"
                        value={sourceSearch}
                        onChange={(e) => setSourceSearch(e.target.value)}
                        className="w-full bg-transparent font-sans text-xs outline-none text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-sans px-1">
                      <button
                        type="button"
                        onClick={handleSelectAllSources}
                        className="text-accent hover:underline font-mono"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={handleClearSources}
                        className="text-muted-foreground hover:underline font-mono"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1 border-t border-border pt-2">
                      {filteredSourcesList.map((source) => {
                        const isChecked =
                          filters.sourceIds?.includes(source.id) ?? filters.sourceId === source.id
                        return (
                          <label
                            key={source.id}
                            className="flex items-center gap-2 px-2 py-1 hover:bg-muted/30 cursor-pointer font-sans text-xs select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSourceId(source.id)}
                              className="cursor-pointer h-3.5 w-3.5 accent-foreground"
                            />
                            <span className="truncate flex-1 text-foreground">{source.name}</span>
                          </label>
                        )
                      })}
                      {filteredSourcesList.length === 0 && (
                        <p className="text-xs text-muted-foreground p-2">No matching sources</p>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Date Range */}
            <div className="space-y-1.5">
              <label
                htmlFor="filter-date-range"
                className="font-sans text-xs text-muted-foreground"
              >
                Date range
              </label>
              <Popover open={isDatePickerOpen} onOpenChange={handleDatePickerOpenChange}>
                <PopoverTrigger asChild>
                  <button
                    id="filter-date-range"
                    type="button"
                    className="w-full h-9 flex items-center gap-2 px-3 font-sans text-sm text-foreground bg-input border border-border hover:bg-card focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none transition-colors"
                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  >
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className={dateRange.from ? "text-foreground" : "text-muted-foreground"}>
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} —{" "}
                            {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        "Pick a date range"
                      )}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 z-[9999]"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
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
              <label htmlFor="filter-sort" className="font-sans text-xs text-muted-foreground">
                Sort by
              </label>
              <Select value={filters.sort} onValueChange={handleSortChange}>
                <SelectTrigger
                  id="filter-sort"
                  className="bg-input border-border font-sans text-sm h-9 focus-visible:ring-accent"
                >
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
                {isCategoryFiltered && (
                  <span className="inline-flex items-center gap-1 font-sans text-[11px] text-foreground border border-border px-2 py-1">
                    {CATEGORY_OPTIONS.find((c) => c.value === filters.category)?.label}
                    <button
                      type="button"
                      aria-label="Remove category filter"
                      onClick={() => handleCategoryChange("all")}
                      className="p-1 -m-1 flex items-center justify-center hover:text-accent transition-colors"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
                {selectedSourceCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-sans text-[11px] text-foreground border border-border px-2 py-1">
                    {selectedSourceCount} {selectedSourceCount === 1 ? "source" : "sources"}
                    <button
                      type="button"
                      aria-label="Remove sources filter"
                      onClick={handleClearSources}
                      className="p-1 -m-1 flex items-center justify-center hover:text-accent transition-colors"
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
                      className="p-1 -m-1 flex items-center justify-center hover:text-accent transition-colors"
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
