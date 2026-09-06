"use client"

import { useState, useMemo } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CalendarIcon, ChevronDown, RotateCcw, Search, X } from "lucide-react"
import { format } from "date-fns"
import type { SourceCategory } from "@/lib/types"

export interface SourceOption {
  id: string
  name: string
  category?: SourceCategory
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

interface FilterPanelProps {
  sources: SourceOption[]
  filters?: FilterOptions
  onFilter: (filters: FilterOptions) => void
  onReset?: () => void
}

const DEFAULT_FILTERS: FilterOptions = { sort: "date-desc", category: "all" }

const SORT_LABELS: Record<SortOption, string> = {
  "date-desc": "Date (newest first)",
  "date-asc": "Date (oldest first)",
  "domain-asc": "Domain (A\u2013Z)",
  "domain-desc": "Domain (Z\u2013A)",
}

export function FilterPanel({
  sources,
  filters = DEFAULT_FILTERS,
  onFilter,
  onReset,
}: FilterPanelProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [isSourcePickerOpen, setIsSourcePickerOpen] = useState(false)
  const [sourceSearch, setSourceSearch] = useState("")
  const [mobileOpen, setMobileOpen] = useState(false)

  const sortedSources = useMemo(
    () => [...sources].sort((a, b) => a.name.localeCompare(b.name)),
    [sources]
  )
  const filteredSourcesList = useMemo(
    () => sortedSources.filter((s) => s.name.toLowerCase().includes(sourceSearch.toLowerCase())),
    [sortedSources, sourceSearch]
  )

  const toggleSourceId = (id: string) => {
    const current = filters.sourceIds || []
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    onFilter({ ...filters, sourceIds: next.length > 0 ? next : undefined, sourceId: undefined })
  }

  const handleSelectAllSources = () => {
    onFilter({
      ...filters,
      sourceIds: sortedSources.map((s) => s.id),
      sourceId: undefined,
    })
  }

  const handleClearSources = () => {
    onFilter({ ...filters, sourceIds: undefined, sourceId: undefined })
  }

  const handleDateRangeChange = (range: { from?: Date; to?: Date }) => {
    onFilter({
      ...filters,
      dateRange: range.from && range.to ? { from: range.from, to: range.to } : undefined,
    })
  }

  const handleDatePickerOpenChange = (open: boolean) => {
    if (!open && filters.dateRange?.from && !filters.dateRange?.to) {
      onFilter({ ...filters, dateRange: undefined })
    }
    setIsDatePickerOpen(open)
  }

  const handleSortChange = (sort: SortOption) => {
    onFilter({ ...filters, sort })
  }

  const clearFilters = () => {
    onFilter({
      ...filters,
      sort: "date-desc",
      sourceIds: undefined,
      sourceId: undefined,
      dateRange: undefined,
    })
    onReset?.()
  }

  const selectedSourceCount = filters.sourceIds?.length ?? (filters.sourceId ? 1 : 0)
  const isDateRangeFiltered = Boolean(filters.dateRange?.from)
  const isSortFiltered = Boolean(filters.sort && filters.sort !== "date-desc")
  const hasActiveFilters = selectedSourceCount > 0 || isDateRangeFiltered || isSortFiltered
  const activeFilterCount = [selectedSourceCount > 0, isDateRangeFiltered, isSortFiltered].filter(
    Boolean
  ).length

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden transition-all">
      <div className="flex items-center justify-between border-b border-border/60 px-3.5 py-2.5 bg-card">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-xs font-semibold tracking-tight text-foreground">
            Filters
          </span>
          {activeFilterCount > 0 && (
            <span className="flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="font-sans text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 flex items-center gap-1 transition-all px-3 py-1 rounded-full shadow-xs cursor-pointer active:scale-95 min-h-[28px]"
              title="Reset all filters to default"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              <span>Reset all</span>
            </button>
          )}
          <button
            type="button"
            aria-label={mobileOpen ? "Collapse filter options" : "Expand filter options"}
            aria-expanded={mobileOpen}
            aria-controls="filter-panel-body"
            onClick={() => setMobileOpen((o) => !o)}
            className="lg:hidden p-2 -mr-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer flex items-center justify-center min-h-[36px] min-w-[36px]"
          >
            <ChevronDown
              className={`h-4 w-4 sm:h-3.5 sm:w-3.5 transition-transform duration-200 ${mobileOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      <div
        id="filter-panel-body"
        className={`grid transition-[grid-template-rows] duration-200 ease-out lg:grid-rows-[1fr] ${mobileOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="p-3.5 space-y-3">
            {/* Multi-Choice Sources Filter */}
            <div className="space-y-1">
              <label
                htmlFor="filter-sources"
                className="font-sans text-[11px] font-medium text-muted-foreground"
              >
                Sources ({selectedSourceCount > 0 ? `${selectedSourceCount} selected` : "All"})
              </label>
              <Popover open={isSourcePickerOpen} onOpenChange={setIsSourcePickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    id="filter-sources"
                    type="button"
                    className="w-full h-9 sm:h-8 flex items-center justify-between px-2.5 font-sans text-xs text-foreground bg-input border border-border/80 rounded-lg hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-all cursor-pointer"
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
                <PopoverContent
                  className="w-68 p-0 z-50 rounded-xl border border-border/80 shadow-lg overflow-hidden"
                  align="start"
                  sideOffset={4}
                >
                  <div className="p-2.5 bg-card space-y-2">
                    <div className="flex items-center gap-1.5 border border-border/80 bg-input px-2.5 py-1.5 rounded-lg focus-within:ring-2 focus-within:ring-primary/30">
                      <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                      <input
                        type="text"
                        placeholder="Search sources…"
                        aria-label="Filter available sources"
                        value={sourceSearch}
                        onChange={(e) => setSourceSearch(e.target.value)}
                        className="w-full bg-transparent font-sans text-base sm:text-xs outline-none text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-sans px-1">
                      <button
                        type="button"
                        onClick={handleSelectAllSources}
                        className="text-primary hover:underline font-medium cursor-pointer"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={handleClearSources}
                        className="text-muted-foreground hover:underline font-medium cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="max-h-44 overflow-y-auto space-y-0.5 pr-1 border-t border-border/60 pt-1.5">
                      {filteredSourcesList.map((source) => {
                        const isChecked =
                          filters.sourceIds?.includes(source.id) ?? filters.sourceId === source.id
                        return (
                          <label
                            key={source.id}
                            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/60 cursor-pointer font-sans text-xs select-none transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSourceId(source.id)}
                              className="cursor-pointer h-3.5 w-3.5 rounded text-primary accent-primary"
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
            <div className="space-y-1">
              <label
                htmlFor="filter-date-range"
                className="font-sans text-[11px] font-medium text-muted-foreground"
              >
                Date range
              </label>
              <Popover open={isDatePickerOpen} onOpenChange={handleDatePickerOpenChange}>
                <PopoverTrigger asChild>
                  <button
                    id="filter-date-range"
                    type="button"
                    className="w-full h-9 sm:h-8 flex items-center gap-2 px-2.5 font-sans text-xs text-foreground bg-input border border-border/80 rounded-lg hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-all cursor-pointer"
                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  >
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span
                      className={
                        filters.dateRange?.from
                          ? "text-foreground truncate"
                          : "text-muted-foreground truncate"
                      }
                    >
                      {filters.dateRange?.from ? (
                        filters.dateRange.to ? (
                          <>
                            {format(filters.dateRange.from, "LLL dd, y")} —{" "}
                            {format(filters.dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(filters.dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        "Pick a date range"
                      )}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 z-50 rounded-2xl border border-border/80 shadow-lg overflow-hidden"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  <div className="p-3 bg-card">
                    <Calendar
                      mode="range"
                      defaultMonth={filters.dateRange?.from || new Date()}
                      selected={
                        filters.dateRange
                          ? { from: filters.dateRange.from, to: filters.dateRange.to }
                          : undefined
                      }
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
            <div className="space-y-1">
              <label
                htmlFor="filter-sort"
                className="font-sans text-[11px] font-medium text-muted-foreground"
              >
                Sort by
              </label>
              <Select value={filters.sort} onValueChange={handleSortChange}>
                <SelectTrigger
                  id="filter-sort"
                  className="bg-input border-border/80 font-sans text-xs h-9 sm:h-8 rounded-lg px-2.5 focus-visible:ring-primary"
                >
                  <SelectValue placeholder={SORT_LABELS[filters.sort]} />
                </SelectTrigger>
                <SelectContent className="font-sans text-xs rounded-xl border border-border/80 shadow-md">
                  {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value} className="rounded-lg text-xs">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active filter chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/60">
                {selectedSourceCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                    {selectedSourceCount} {selectedSourceCount === 1 ? "source" : "sources"}
                    <button
                      type="button"
                      aria-label="Remove sources filter"
                      onClick={handleClearSources}
                      className="p-1 -mr-1 rounded-full hover:bg-primary/20 transition-colors cursor-pointer flex items-center justify-center min-h-[22px] min-w-[22px]"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
                {filters.dateRange && (
                  <span className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                    Date range
                    <button
                      type="button"
                      aria-label="Remove date range filter"
                      onClick={() => handleDateRangeChange({})}
                      className="p-1 -mr-1 rounded-full hover:bg-primary/20 transition-colors cursor-pointer flex items-center justify-center min-h-[22px] min-w-[22px]"
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
