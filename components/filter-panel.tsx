"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, Filter, X } from "lucide-react"
import { format } from "date-fns"
import type { NewsItem } from "@/lib/firebase"

interface FilterPanelProps {
  news: NewsItem[]
  onFilter: (filters: FilterOptions) => void
}

export interface FilterOptions {
  domain?: string
  dateRange?: {
    from: Date
    to: Date
  }
  sortBy: "date" | "domain"
  sortOrder: "asc" | "desc"
}

export function FilterPanel({ news, onFilter }: FilterPanelProps) {
  const [filters, setFilters] = useState<FilterOptions>({
    sortBy: "date",
    sortOrder: "desc",
  })
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)

  // Extract unique domains from news
  const domains = Array.from(new Set(news.map((item) => item.domain))).sort()

  useEffect(() => {
    onFilter(filters)
  }, [filters, onFilter])

  const handleDomainChange = (domain: string) => {
    setFilters((prev) => ({
      ...prev,
      domain: domain === "all" ? undefined : domain,
    }))
  }

  const handleDateRangeChange = (range: { from?: Date; to?: Date }) => {
    console.log("Date range changed:", range)
    setDateRange(range)
    setFilters((prev) => ({
      ...prev,
      dateRange: range.from && range.to ? { from: range.from, to: range.to } : undefined,
    }))
  }

  const handleSortChange = (sortBy: "date" | "domain") => {
    setFilters((prev) => ({
      ...prev,
      sortBy,
    }))
  }

  const handleSortOrderChange = (sortOrder: "asc" | "desc") => {
    setFilters((prev) => ({
      ...prev,
      sortOrder,
    }))
  }

  const clearFilters = () => {
    setFilters({
      sortBy: "date",
      sortOrder: "desc",
    })
    setDateRange({})
  }

  const hasActiveFilters = filters.domain || filters.dateRange

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-playfair flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Domain Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Domain</label>
          <Select value={filters.domain || "all"} onValueChange={handleDomainChange}>
            <SelectTrigger className="bg-input border-border">
              <SelectValue placeholder="All domains" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All domains</SelectItem>
              {domains.map((domain) => (
                <SelectItem key={domain} value={domain}>
                  {domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Date Range</label>
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-start text-left font-normal bg-input border-border"
                onClick={() => {
                  console.log("Date picker button clicked")
                  setIsDatePickerOpen(!isDatePickerOpen)
                }}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-0 z-[9999]" 
              align="start"
              side="bottom"
              sideOffset={4}
            >
              <div className="p-4 bg-white border rounded-md shadow-lg">
                <Calendar
                  mode="range"
                  defaultMonth={dateRange.from || new Date()}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    console.log("Calendar onSelect called with:", range)
                    handleDateRangeChange(range || {})
                    if (range?.from && range?.to) {
                      setIsDatePickerOpen(false)
                    }
                  }}
                  numberOfMonths={2}
                  className="rounded-md border"
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Sort Options */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Sort by</label>
          <div className="flex gap-2">
            <Select value={filters.sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="domain">Domain</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.sortOrder} onValueChange={handleSortOrderChange}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Newest first</SelectItem>
                <SelectItem value="asc">Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Active Filters</label>
            <div className="flex flex-wrap gap-2">
              {filters.domain && (
                <Badge variant="secondary" className="text-xs">
                  Domain: {filters.domain}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-1 h-3 w-3 p-0"
                    onClick={() => handleDomainChange("all")}
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </Badge>
              )}
              {filters.dateRange && (
                <Badge variant="secondary" className="text-xs">
                  Date Range
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-1 h-3 w-3 p-0"
                    onClick={() => handleDateRangeChange({})}
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
