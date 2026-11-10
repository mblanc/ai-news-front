"use client"

import { useEffect, useRef, useState } from "react"
import type { Source, SourceType, SourceCategory } from "@/lib/types"
import type { IngestStats } from "@/lib/ingest"
import { isIngestErrorLine } from "@/lib/ingest-log"
import { CATEGORY_ACCENT_CLASSES } from "@/lib/color-tokens"

function apiFetch(path: string, init?: RequestInit) {
  return fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  })
}

type IngestState = "idle" | "running" | "done" | "error"
type DedupState = "idle" | "running" | "done" | "error"

interface EditDraft {
  name: string
  url: string
  type: SourceType
  category: SourceCategory
}

const CATEGORY_TABS: Array<{ value: SourceCategory | "all"; label: string; icon: string }> = [
  { value: "all", label: "All Categories", icon: "🌐" },
  { value: "industry-news", label: "Industry News", icon: "🏢" },
  { value: "ai-engineering", label: "AI Engineering", icon: "🛠️" },
  { value: "frontier-research", label: "Frontier R&D", icon: "🧪" },
  { value: "genmedia", label: "GenMedia", icon: "🎨" },
  { value: "ecosystem-analysis", label: "Ecosystem Analysis", icon: "📰" },
]

export default function SourcesPage() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<"sources" | "ingest">("sources")
  const [sources, setSources] = useState<Source[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // Admin-only state for adding sources
  const [showAdd, setShowAdd] = useState(false)
  const [adding, setAdding] = useState(false)
  const urlRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLSelectElement>(null)

  // Admin-only state for editing / deleting
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Admin-only state for ingestion pipeline
  const [ingestState, setIngestState] = useState<IngestState>("idle")
  const [ingestLog, setIngestLog] = useState<string[]>([])
  const [ingestStats, setIngestStats] = useState<IngestStats | null>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)

  // Admin-only state for maintenance tools
  const [dedupState, setDedupState] = useState<DedupState>("idle")
  const [dedupMessage, setDedupMessage] = useState<string | null>(null)
  const [digestState, setDigestState] = useState<"idle" | "running" | "done" | "error">("idle")
  const [digestMessage, setDigestMessage] = useState<string | null>(null)
  const [emailState, setEmailState] = useState<"idle" | "running" | "done" | "error">("idle")
  const [emailMessage, setEmailMessage] = useState<string | null>(null)

  // Sorting and filtering
  const [sortField, setSortField] = useState<
    "name" | "url" | "type" | "category" | "enabled" | null
  >(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<SourceCategory | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch auth status
  useEffect(() => {
    const roleParam =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("role") : null
    const authUrl = roleParam
      ? `/api/auth/me?role=${encodeURIComponent(roleParam)}`
      : "/api/auth/me"

    fetch(authUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.isAdmin) {
          setIsAdmin(true)
          if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search)
            if (params.get("tab") === "ingest") {
              setActiveTab("ingest")
            }
          }
        } else {
          setIsAdmin(false)
        }
      })
      .catch(() => {
        // Silently default to false
        setIsAdmin(false)
      })
  }, [])

  // Fetch sources list
  useEffect(() => {
    setLoading(true)
    apiFetch("/api/sources")
      .then((r) => r.json())
      .then((data) => setSources(data.sources ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Auto-scroll log container
  useEffect(() => {
    const el = logContainerRef.current
    if (!el) return
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8
    if (isAtBottom) el.scrollTop = el.scrollHeight
  }, [ingestLog])

  const handleSort = (field: "name" | "url" | "type" | "category" | "enabled") => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else {
        setSortField(null)
      }
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const filteredSources = sources.filter((source) => {
    const matchesCategory =
      selectedCategoryTab === "all" || (source.category ?? "industry-news") === selectedCategoryTab

    const query = searchQuery.trim().toLowerCase()
    const matchesSearch =
      !query ||
      source.name.toLowerCase().includes(query) ||
      source.url.toLowerCase().includes(query)

    return matchesCategory && matchesSearch
  })

  const sortedSources = [...filteredSources].sort((a, b) => {
    if (!sortField) return 0

    let aValue = a[sortField]
    let bValue = b[sortField]

    if (sortField === "category") {
      aValue = a.category ?? "industry-news"
      bValue = b.category ?? "industry-news"
    }

    if (aValue === undefined || aValue === null) aValue = ""
    if (bValue === undefined || bValue === null) bValue = ""

    if (typeof aValue === "boolean" && typeof bValue === "boolean") {
      if (aValue === bValue) return 0
      return sortDirection === "asc" ? (aValue ? 1 : -1) : aValue ? -1 : 1
    }

    const aStr = String(aValue).toLowerCase()
    const bStr = String(bValue).toLowerCase()

    if (aStr < bStr) return sortDirection === "asc" ? -1 : 1
    if (aStr > bStr) return sortDirection === "asc" ? 1 : -1
    return 0
  })

  const renderSortIcon = (field: "name" | "url" | "type" | "category" | "enabled") => {
    if (sortField !== field) {
      return (
        <span className="ml-1 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors font-sans text-[8px] tracking-normal select-none">
          ▲▼
        </span>
      )
    }
    return (
      <span className="ml-1 text-foreground font-sans text-[8px] tracking-normal select-none">
        {sortDirection === "asc" ? "▲" : "▼"}
      </span>
    )
  }

  // Admin actions
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const url = urlRef.current?.value.trim() ?? ""
    const name = nameRef.current?.value.trim() || undefined
    const category = (categoryRef.current?.value as SourceCategory) || "industry-news"
    if (!url) return
    setAdding(true)
    try {
      const r = await apiFetch("/api/sources", {
        method: "POST",
        body: JSON.stringify({ url, name, category }),
      })
      if (!r.ok) {
        const errorData = await r.json().catch(() => null)
        throw new Error(errorData?.error ?? "Failed to add source")
      }
      const source = await r.json()
      setSources((prev) => [source, ...prev])
      setShowAdd(false)
      if (urlRef.current) urlRef.current.value = ""
      if (nameRef.current) nameRef.current.value = ""
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAdding(false)
    }
  }

  async function handleToggle(source: Source) {
    const r = await apiFetch(`/api/sources/${source.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !source.enabled }),
    })
    if (r.ok) {
      const updated = await r.json()
      setSources((prev) => prev.map((s) => (s.id === source.id ? updated : s)))
    }
  }

  function startEdit(source: Source) {
    setEditingId(source.id)
    setDeleteConfirm(null)
    setEditDraft({
      name: source.name ?? "",
      url: source.url,
      type: source.type,
      category: source.category ?? "industry-news",
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(null)
  }

  async function handleSaveEdit(id: string) {
    if (!editDraft) return
    setSaving(true)
    try {
      const trimmedDraft = {
        name: editDraft.name.trim(),
        url: editDraft.url.trim(),
        type: editDraft.type,
        category: editDraft.category,
      }
      const r = await apiFetch(`/api/sources/${id}`, {
        method: "PATCH",
        body: JSON.stringify(trimmedDraft),
      })
      if (!r.ok) {
        const errorData = await r.json().catch(() => null)
        throw new Error(errorData?.error ?? "Failed to save")
      }
      const updated = await r.json()
      setSources((prev) => prev.map((s) => (s.id === id ? updated : s)))
      setEditingId(null)
      setEditDraft(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const r = await apiFetch(`/api/sources/${id}`, { method: "DELETE" })
    if (r.ok || r.status === 204) {
      setSources((prev) => prev.filter((s) => s.id !== id))
      setDeleteConfirm(null)
    }
  }

  async function handleIngest() {
    setIngestState("running")
    setIngestLog([])
    setIngestStats(null)

    try {
      const res = await fetch("/api/ingest", { method: "POST" })
      if (!res.body) throw new Error("No response body")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const payload = JSON.parse(line.slice(6))
            if (payload.type === "log") {
              setIngestLog((prev) => [...prev, payload.message])
            } else if (payload.type === "done") {
              setIngestStats(payload.stats)
              setIngestState("done")
            } else if (payload.type === "error") {
              setIngestLog((prev) => [...prev, `Error: ${payload.message}`])
              setIngestState("error")
            }
          } catch {
            // malformed event line — skip
          }
        }
      }
    } catch (e) {
      setIngestLog((prev) => [...prev, `Fatal: ${(e as Error).message}`])
      setIngestState("error")
    }
  }

  async function handleDedup() {
    setDedupState("running")
    setDedupMessage(null)
    try {
      const r = await apiFetch("/api/admin/dedup-clusters", { method: "POST" })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? "Dedup failed")
      setDedupMessage(data.message)
      setDedupState("done")
    } catch (e) {
      setDedupMessage((e as Error).message)
      setDedupState("error")
    }
  }

  async function handleGenerateDigest(scope: string = "daily") {
    setDigestState("running")
    setDigestMessage(null)
    try {
      const r = await apiFetch("/api/admin/generate-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      })
      const data = await r.json()
      if (!r.ok || !data.success) throw new Error(data.error ?? "Digest generation failed")
      setDigestMessage(data.message)
      setDigestState("done")
    } catch (e) {
      setDigestMessage((e as Error).message)
      setDigestState("error")
    }
  }

  async function handleSendTestEmail() {
    setEmailState("running")
    setEmailMessage(null)
    try {
      const r = await apiFetch("/api/admin/send-email", { method: "POST" })
      const data = await r.json()
      if (!r.ok || !data.success) throw new Error(data.error ?? "Failed to send email digest")
      setEmailMessage(data.message)
      setEmailState("done")
    } catch (e) {
      setEmailMessage((e as Error).message)
      setEmailState("error")
    }
  }

  const inputCls =
    "border border-border/80 bg-input px-3 py-1.5 rounded-lg font-sans text-base sm:text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 w-full transition-all h-9 sm:h-7"

  return (
    <div className="space-y-4">
      {/* Tabs Header - only shown to admin users */}
      {isAdmin && (
        <div className="flex items-center gap-1 p-1 rounded-full bg-muted/60 border border-border/80 w-fit mb-4">
          <button
            type="button"
            onClick={() => setActiveTab("sources")}
            className={`px-3.5 py-1.5 sm:py-1 font-sans text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer min-h-[36px] sm:min-h-0 flex items-center ${
              activeTab === "sources"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            Sources ({sources.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ingest")}
            className={`px-3.5 py-1.5 sm:py-1 font-sans text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer min-h-[36px] sm:min-h-0 flex items-center ${
              activeTab === "ingest"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            Ingestion Pipeline
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive mb-4 font-sans">
          {error}
        </div>
      )}

      {/* Tab Content: Sources (Visible to all users, activeTab forced to sources for non-admin) */}
      {(activeTab === "sources" || !isAdmin) && (
        <section className="space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-foreground">
                News Sources
              </h2>
              <p className="font-sans text-[11px] text-muted-foreground mt-0.5">
                {isAdmin
                  ? "Manage the active RSS feeds and websites scraped hourly."
                  : "Active RSS feeds and websites aggregated hourly."}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter sources…"
                aria-label="Filter sources by name or URL"
                className="w-full sm:w-56 border border-border/80 bg-input px-3 py-2 sm:py-1.5 rounded-lg font-sans text-base sm:text-xs h-10 sm:h-8 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowAdd((v) => !v)}
                  className="rounded-full border border-border bg-card px-3.5 py-2 sm:px-3 sm:py-1.5 font-sans text-xs font-semibold hover:border-primary hover:text-primary transition-all shadow-xs shrink-0 cursor-pointer h-10 sm:h-8 flex items-center justify-center"
                >
                  {showAdd ? "Cancel" : "+ Add source"}
                </button>
              )}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const count =
                tab.value === "all"
                  ? sources.length
                  : sources.filter((s) => (s.category ?? "industry-news") === tab.value).length

              const isSelected = selectedCategoryTab === tab.value

              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setSelectedCategoryTab(tab.value)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-sans text-xs font-medium whitespace-nowrap transition-all cursor-pointer min-h-[32px] sm:min-h-0 border ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card border-border/80 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Add source form (Admin only) */}
          {isAdmin && showAdd && (
            <form
              onSubmit={handleAdd}
              className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-card border border-border/80 p-3 rounded-xl shadow-xs"
            >
              <input
                ref={urlRef}
                placeholder="https://example.com/rss.xml"
                required
                className={inputCls}
                aria-label="Source URL"
              />
              <input
                ref={nameRef}
                placeholder="Name (optional)"
                className={inputCls}
                aria-label="Source Name"
              />
              <select
                ref={categoryRef}
                defaultValue="industry-news"
                className={inputCls}
                aria-label="Source Category"
              >
                <option value="industry-news">🏢 Industry News</option>
                <option value="ai-engineering">🛠️ AI Engineering</option>
                <option value="frontier-research">🧪 Frontier R&D</option>
                <option value="genmedia">🎨 GenMedia</option>
                <option value="ecosystem-analysis">📰 Ecosystem Analysis</option>
              </select>
              <button
                type="submit"
                disabled={adding}
                className="w-full sm:w-auto rounded-full bg-primary text-primary-foreground hover:opacity-95 px-4 py-2 sm:py-1.5 font-sans text-xs font-semibold shadow-xs disabled:opacity-50 transition-all cursor-pointer h-10 sm:h-8 flex items-center justify-center"
              >
                {adding ? "Saving…" : "Save Source"}
              </button>
            </form>
          )}

          {loading ? (
            <div className="rounded-2xl border border-border/80 bg-card p-8 text-center">
              <p className="font-sans text-xs text-muted-foreground animate-pulse">
                Loading sources…
              </p>
            </div>
          ) : sortedSources.length === 0 ? (
            <p className="font-sans text-xs text-muted-foreground py-4">
              {sources.length === 0
                ? "No sources yet."
                : "No sources found matching the selected category or search filter."}
            </p>
          ) : (
            <div className="rounded-2xl border border-border/80 bg-card overflow-x-auto shadow-xs overscroll-x-contain">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/40">
                    <th
                      scope="col"
                      aria-sort={
                        sortField === "name"
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className="py-2 px-3.5 text-left font-sans text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort("name")}
                        className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded py-1 min-h-[32px] sm:min-h-0"
                      >
                        <span>Name</span>
                        {renderSortIcon("name")}
                      </button>
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        sortField === "url"
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className="py-2 px-3.5 text-left font-sans text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort("url")}
                        className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded py-1 min-h-[32px] sm:min-h-0"
                      >
                        <span>URL</span>
                        {renderSortIcon("url")}
                      </button>
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        sortField === "type"
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className="py-2 px-3.5 text-left font-sans text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-20"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort("type")}
                        className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded py-1 min-h-[32px] sm:min-h-0"
                      >
                        <span>Type</span>
                        {renderSortIcon("type")}
                      </button>
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        sortField === "category"
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className="py-2 px-3.5 text-left font-sans text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-40"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort("category")}
                        className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded py-1 min-h-[32px] sm:min-h-0"
                      >
                        <span>Category</span>
                        {renderSortIcon("category")}
                      </button>
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        sortField === "enabled"
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className="py-2 px-3.5 text-left font-sans text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-24"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort("enabled")}
                        className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded py-1 min-h-[32px] sm:min-h-0"
                      >
                        <span>Active</span>
                        {renderSortIcon("enabled")}
                      </button>
                    </th>
                    {isAdmin && (
                      <th
                        scope="col"
                        className="py-2.5 px-3.5 w-28 text-right font-sans text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sortedSources.map((source) =>
                    isAdmin && editingId === source.id && editDraft ? (
                      <tr
                        key={source.id}
                        className="border-b border-border/60 bg-muted/20 last:border-0"
                      >
                        <td className="py-2 px-3.5">
                          <input
                            className={inputCls}
                            value={editDraft.name}
                            onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                            placeholder="Name"
                            aria-label="Edit source name"
                          />
                        </td>
                        <td className="py-2 px-3.5">
                          <input
                            className={inputCls}
                            value={editDraft.url}
                            onChange={(e) => setEditDraft({ ...editDraft, url: e.target.value })}
                            placeholder="https://…"
                            aria-label="Edit source URL"
                          />
                        </td>
                        <td className="py-2 px-3.5">
                          <select
                            className={inputCls}
                            value={editDraft.type}
                            aria-label="Edit source type"
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, type: e.target.value as SourceType })
                            }
                          >
                            <option value="rss">rss</option>
                            <option value="page">page</option>
                          </select>
                        </td>
                        <td className="py-2 px-3.5">
                          <select
                            className={inputCls}
                            value={editDraft.category ?? "industry-news"}
                            aria-label="Edit source category"
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                category: e.target.value as SourceCategory,
                              })
                            }
                          >
                            <option value="industry-news">Industry News</option>
                            <option value="ai-engineering">AI Engineering</option>
                            <option value="frontier-research">Frontier R&D</option>
                            <option value="genmedia">GenMedia</option>
                            <option value="ecosystem-analysis">Ecosystem Analysis</option>
                          </select>
                        </td>
                        <td className="py-2 px-3.5" />
                        <td className="py-2 px-3.5 text-right">
                          <div className="flex gap-2 justify-end items-center">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(source.id)}
                              disabled={saving}
                              className="font-sans text-xs font-semibold text-primary hover:underline disabled:opacity-50 cursor-pointer min-h-[32px] sm:min-h-0 flex items-center px-1"
                            >
                              {saving ? "…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="font-sans text-xs text-muted-foreground hover:underline cursor-pointer min-h-[32px] sm:min-h-0 flex items-center px-1"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={source.id}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors last:border-0"
                      >
                        <td className="py-2.5 px-3.5 font-display text-xs font-semibold text-foreground">
                          {source.name}
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-[11px] text-muted-foreground max-w-xs truncate">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline hover:text-primary transition-colors inline-flex items-center gap-1"
                            title={source.url}
                          >
                            <span>{source.url}</span>
                          </a>
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span
                            className={`border px-2 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-wider font-semibold ${
                              source.type === "rss"
                                ? "bg-primary/10 text-primary border-primary/20"
                                : "bg-secondary text-secondary-foreground border-border/80"
                            }`}
                          >
                            {source.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span
                            className={`border px-2.5 py-0.5 rounded-full font-sans text-[11px] ${
                              CATEGORY_ACCENT_CLASSES[source.category ?? "industry-news"]?.badge ??
                              "border-border/70 text-foreground bg-muted/40 font-medium"
                            }`}
                          >
                            {source.category ?? "industry-news"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5">
                          {isAdmin ? (
                            <input
                              type="checkbox"
                              checked={source.enabled}
                              onChange={() => handleToggle(source)}
                              aria-label={`Toggle active state for ${source.name}`}
                              className="cursor-pointer h-4 w-4 sm:h-3.5 sm:w-3.5 rounded border-border/80 text-primary focus:ring-2 focus:ring-primary/20 accent-primary"
                            />
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[10px] font-medium ${
                                source.enabled
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-muted text-muted-foreground border border-border/60"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  source.enabled ? "bg-emerald-500" : "bg-muted-foreground/40"
                                }`}
                              />
                              {source.enabled ? "Active" : "Inactive"}
                            </span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="py-2.5 px-3.5 text-right">
                            <div className="flex gap-2 items-center justify-end">
                              <button
                                type="button"
                                onClick={() => startEdit(source)}
                                className="font-sans text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 sm:px-2 sm:py-0.5 min-h-[32px] sm:min-h-0 flex items-center rounded-full hover:bg-muted/80 transition-all cursor-pointer"
                              >
                                Edit
                              </button>
                              {deleteConfirm === source.id ? (
                                <div className="flex gap-1.5 items-center bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-full min-h-[32px] sm:min-h-0 animate-in fade-in zoom-in-95 duration-150 ease-[cubic-bezier(0.2,0,0,1)]">
                                  <span className="font-sans text-[11px] text-destructive font-medium">
                                    Delete?
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(source.id)}
                                    className="font-sans text-xs font-bold text-destructive hover:underline cursor-pointer min-h-[28px] sm:min-h-0 flex items-center"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirm(null)}
                                    className="font-sans text-xs text-muted-foreground hover:text-foreground cursor-pointer min-h-[28px] sm:min-h-0 flex items-center"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirm(source.id)}
                                  className="font-sans text-xs text-muted-foreground hover:text-destructive px-2.5 py-1.5 sm:px-2 sm:py-0.5 min-h-[32px] sm:min-h-0 flex items-center rounded-full hover:bg-destructive/10 transition-all cursor-pointer"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab Content: Ingestion (Admin only) */}
      {isAdmin && activeTab === "ingest" && (
        <section className="space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-foreground">
                Ingestion Pipeline
              </h2>
              <p className="font-sans text-[11px] text-muted-foreground mt-0.5">
                Manually trigger the 9-step parsing, scraping, embedding, clustering, and
                summarizing engine.
              </p>
            </div>
            <button
              type="button"
              onClick={handleIngest}
              disabled={ingestState === "running"}
              className="rounded-full bg-primary text-primary-foreground hover:opacity-95 px-4 py-2 sm:py-1.5 font-sans text-xs font-semibold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0 min-h-[36px] sm:min-h-0 flex items-center justify-center"
            >
              {ingestState === "running" ? "Running…" : "Run Ingestion"}
            </button>
          </div>

          {/* Dedup panel */}
          <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-sans text-xs font-semibold text-foreground">
                Deduplicate clusters
              </p>
              <p className="font-sans text-[11px] text-muted-foreground mt-0.5">
                Merge clusters with cosine similarity ≥ 0.82, keeping the oldest as canonical.
              </p>
              {dedupMessage && (
                <p
                  className={`font-sans text-[11px] mt-1 ${dedupState === "error" ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {dedupMessage}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleDedup}
              disabled={dedupState === "running"}
              className="shrink-0 rounded-full border border-border/80 bg-card px-3.5 py-2 sm:px-3 sm:py-1.5 font-sans text-xs font-semibold hover:border-primary hover:text-primary transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[36px] sm:min-h-0 flex items-center justify-center"
            >
              {dedupState === "running" ? "Running…" : "Run Dedup"}
            </button>
          </div>

          {/* Digest panel */}
          <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-sans text-xs font-semibold text-foreground">
                Generate Multi-Scope Digests
              </p>
              <p className="font-sans text-[11px] text-muted-foreground mt-0.5">
                Synthesize grounded summaries for Daily, Weekly, Monthly, or All-Time Field
                Overview.
              </p>
              {digestMessage && (
                <p
                  className={`font-sans text-[11px] mt-1 ${digestState === "error" ? "text-destructive" : "text-success"}`}
                >
                  {digestMessage}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {(["daily", "weekly", "monthly", "overview"] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => handleGenerateDigest(scope)}
                  disabled={digestState === "running"}
                  className="rounded-full border border-border/80 bg-card px-3 py-1.5 sm:px-2.5 sm:py-1 font-sans text-xs font-medium hover:border-primary hover:text-primary disabled:opacity-50 transition-all shadow-xs cursor-pointer capitalize min-h-[32px] sm:min-h-0 flex items-center"
                >
                  {scope}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleGenerateDigest("all")}
                disabled={digestState === "running"}
                className="rounded-full bg-primary text-primary-foreground hover:opacity-95 px-3.5 py-1.5 sm:px-3 sm:py-1 font-sans text-xs font-semibold disabled:opacity-50 transition-all shadow-xs cursor-pointer min-h-[32px] sm:min-h-0 flex items-center"
              >
                {digestState === "running" ? "Seeding…" : "Seed All"}
              </button>
            </div>
          </div>

          {/* Email Digest panel */}
          <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-sans text-xs font-semibold text-foreground">Send Email Digest</p>
              <p className="font-sans text-[11px] text-muted-foreground mt-0.5">
                Trigger immediate email dispatch of the latest daily digest and past 24h stories to
                test recipients.
              </p>
              {emailMessage && (
                <p
                  className={`font-sans text-[11px] mt-1 ${emailState === "error" ? "text-destructive" : "text-success"}`}
                >
                  {emailMessage}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={emailState === "running"}
              className="shrink-0 rounded-full border border-border/80 bg-card px-3.5 py-2 sm:px-3 sm:py-1.5 font-sans text-xs font-semibold hover:border-primary hover:text-primary transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[36px] sm:min-h-0 flex items-center justify-center"
            >
              {emailState === "running" ? "Sending…" : "Send Test Email"}
            </button>
          </div>

          {ingestState !== "idle" && (
            <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
              <div className="border-b border-border/80 px-3.5 py-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground bg-muted/30">
                Console Output
              </div>
              <div
                ref={logContainerRef}
                className="h-64 overflow-y-auto p-3 font-mono text-[11px] space-y-1 bg-black text-green-400 selection:bg-green-800 selection:text-white"
              >
                {ingestLog.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.startsWith("Step ")
                        ? "text-white font-semibold mt-2 first:mt-0 text-xs border-b border-zinc-800 pb-0.5"
                        : isIngestErrorLine(line)
                          ? "bg-red-950/80 text-red-200 px-2.5 py-1 rounded-md font-medium"
                          : line.startsWith("  Saved:")
                            ? "text-green-300"
                            : line.startsWith("  Discarded")
                              ? "text-yellow-500/80"
                              : "text-zinc-400"
                    }
                  >
                    {line}
                  </div>
                ))}
                {ingestState === "running" && (
                  <div className="text-green-400 animate-pulse mt-1">▌ Running pipeline...</div>
                )}
              </div>

              {ingestStats && (
                <div className="border-t border-border/80 px-3.5 py-2.5 bg-muted/20 grid grid-cols-2 sm:grid-cols-6 gap-3 font-mono text-[11px] text-muted-foreground">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-muted-foreground/60 uppercase">Sources</span>
                    <span className="font-semibold text-foreground text-xs mt-0.5">
                      {ingestStats.sources}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-muted-foreground/60 uppercase">
                      URLs Found
                    </span>
                    <span className="font-semibold text-foreground text-xs mt-0.5">
                      {ingestStats.urls_found}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-muted-foreground/60 uppercase">
                      New Scraped
                    </span>
                    <span className="font-semibold text-foreground text-xs mt-0.5">
                      {ingestStats.new_articles}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-muted-foreground/60 uppercase">Discarded</span>
                    <span className="font-semibold text-foreground text-xs mt-0.5">
                      {ingestStats.discarded}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-muted-foreground/60 uppercase">Clusters</span>
                    <span className="font-semibold text-foreground text-xs mt-0.5">
                      {ingestStats.clusters_created}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-muted-foreground/60 uppercase">Duration</span>
                    <span className="font-semibold text-foreground text-xs mt-0.5">
                      {(ingestStats.duration_ms / 1000).toFixed(1)}s
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
