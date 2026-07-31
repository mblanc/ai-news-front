"use client"

import { useEffect, useRef, useState } from "react"
import type { Source, SourceType, SourceCategory } from "@/lib/types"
import type { IngestStats } from "@/lib/ingest"
import { isIngestErrorLine } from "@/lib/ingest-log"

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

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"sources" | "ingest">("sources")
  const [sources, setSources] = useState<Source[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const urlRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLSelectElement>(null)

  const [ingestState, setIngestState] = useState<IngestState>("idle")
  const [ingestLog, setIngestLog] = useState<string[]>([])
  const [ingestStats, setIngestStats] = useState<IngestStats | null>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)

  const [dedupState, setDedupState] = useState<DedupState>("idle")
  const [dedupMessage, setDedupMessage] = useState<string | null>(null)
  const [digestState, setDigestState] = useState<"idle" | "running" | "done" | "error">("idle")
  const [digestMessage, setDigestMessage] = useState<string | null>(null)
  const [emailState, setEmailState] = useState<"idle" | "running" | "done" | "error">("idle")
  const [emailMessage, setEmailMessage] = useState<string | null>(null)

  const [sortField, setSortField] = useState<
    "name" | "url" | "type" | "category" | "enabled" | null
  >(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<SourceCategory | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")

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

  useEffect(() => {
    apiFetch("/api/sources")
      .then((r) => r.json())
      .then((data) => setSources(data.sources))
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    const el = logContainerRef.current
    if (!el) return
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8
    if (isAtBottom) el.scrollTop = el.scrollHeight
  }, [ingestLog])

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
    "border border-border bg-background px-2 py-1 font-mono text-xs outline-none focus:border-foreground w-full"

  return (
    <div className="space-y-6">
      {/* Tabs Header */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("sources")}
          className={`px-5 py-2.5 font-mono text-xs uppercase tracking-widest border-t border-l border-r -mb-px transition-colors ${
            activeTab === "sources"
              ? "border-border bg-background font-semibold text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Sources
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ingest")}
          className={`px-5 py-2.5 font-mono text-xs uppercase tracking-widest border-t border-l border-r -mb-px transition-colors ${
            activeTab === "ingest"
              ? "border-border bg-background font-semibold text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Ingestion Pipeline
        </button>
      </div>

      {error && <p className="font-mono text-xs text-red-500 mb-4">{error}</p>}

      {/* Tab Content: Sources */}
      {activeTab === "sources" && (
        <section className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-sans text-lg text-foreground">News Sources</h2>
              <p className="font-sans text-xs text-muted-foreground">
                Manage the active RSS feeds and websites scraped hourly.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter sources..."
                className="w-48 sm:w-64 border border-border bg-background px-3 py-1.5 font-mono text-xs outline-none focus:border-foreground"
              />
              <button
                type="button"
                onClick={() => setShowAdd((v) => !v)}
                className="border border-border px-4 py-2 font-mono text-xs uppercase tracking-widest hover:bg-muted transition-colors shrink-0"
              >
                {showAdd ? "Cancel" : "Add source"}
              </button>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-b border-border pb-3">
            {CATEGORY_TABS.map((tab) => {
              const count =
                tab.value === "all"
                  ? sources.length
                  : sources.filter((s) => (s.category ?? "industry-news") === tab.value).length
              const isActive = selectedCategoryTab === tab.value

              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setSelectedCategoryTab(tab.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs rounded transition-colors ${
                    isActive
                      ? "bg-foreground text-background font-medium"
                      : "bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${
                      isActive
                        ? "bg-background/20 text-background"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {showAdd && (
            <form
              onSubmit={handleAdd}
              className="flex flex-wrap gap-2 p-4 border border-border bg-muted/10 animate-slide-down"
            >
              <input
                ref={urlRef}
                type="url"
                required
                placeholder="https://example.com/feed.xml"
                className="flex-1 min-w-[200px] border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-foreground"
              />
              <input
                ref={nameRef}
                type="text"
                placeholder="Name (auto-detected)"
                className="w-44 border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-foreground"
              />
              <select
                ref={categoryRef}
                className="w-44 border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-foreground"
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
                className="border border-border px-4 py-2 font-mono text-xs uppercase tracking-widest hover:bg-muted disabled:opacity-50 transition-colors"
              >
                {adding ? "Saving…" : "Save"}
              </button>
            </form>
          )}

          {sortedSources.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground py-4">
              {sources.length === 0
                ? "No sources yet. Add a URL above to get started."
                : "No sources found matching the selected category or search filter."}
            </p>
          ) : (
            <div className="border border-border overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/10">
                    <th
                      onClick={() => handleSort("name")}
                      className="py-2.5 px-4 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground select-none group"
                    >
                      <span className="flex items-center gap-1">Name {renderSortIcon("name")}</span>
                    </th>
                    <th
                      onClick={() => handleSort("url")}
                      className="py-2.5 px-4 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground select-none group"
                    >
                      <span className="flex items-center gap-1">URL {renderSortIcon("url")}</span>
                    </th>
                    <th
                      onClick={() => handleSort("type")}
                      className="py-2.5 px-4 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground w-20 cursor-pointer hover:text-foreground select-none group"
                    >
                      <span className="flex items-center gap-1">Type {renderSortIcon("type")}</span>
                    </th>
                    <th
                      onClick={() => handleSort("category")}
                      className="py-2.5 px-4 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground w-40 cursor-pointer hover:text-foreground select-none group"
                    >
                      <span className="flex items-center gap-1">
                        Category {renderSortIcon("category")}
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort("enabled")}
                      className="py-2.5 px-4 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground w-16 cursor-pointer hover:text-foreground select-none group"
                    >
                      <span className="flex items-center gap-1">
                        On {renderSortIcon("enabled")}
                      </span>
                    </th>
                    <th className="py-2.5 px-4 w-28"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSources.map((source) =>
                    editingId === source.id && editDraft ? (
                      <tr
                        key={source.id}
                        className="border-b border-border bg-muted/20 last:border-0"
                      >
                        <td className="py-2 px-4">
                          <input
                            className={inputCls}
                            value={editDraft.name}
                            onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                            placeholder="Name"
                          />
                        </td>
                        <td className="py-2 px-4">
                          <input
                            className={inputCls}
                            value={editDraft.url}
                            onChange={(e) => setEditDraft({ ...editDraft, url: e.target.value })}
                            placeholder="https://…"
                          />
                        </td>
                        <td className="py-2 px-4">
                          <select
                            className={inputCls}
                            value={editDraft.type}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, type: e.target.value as SourceType })
                            }
                          >
                            <option value="rss">rss</option>
                            <option value="page">page</option>
                          </select>
                        </td>
                        <td className="py-2 px-4">
                          <select
                            className={inputCls}
                            value={editDraft.category ?? "industry-news"}
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
                        <td className="py-2 px-4" />
                        <td className="py-2 px-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(source.id)}
                              disabled={saving}
                              className="font-mono text-xs text-foreground hover:underline disabled:opacity-50"
                            >
                              {saving ? "…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="font-mono text-xs text-muted-foreground hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={source.id}
                        className="border-b border-border hover:bg-muted/5 last:border-0"
                      >
                        <td className="py-3 px-4 font-sans text-sm text-foreground">
                          {source.name}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground max-w-xs truncate">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            {source.url}
                          </a>
                        </td>
                        <td className="py-3 px-4">
                          <span className="border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/30">
                            {source.type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground bg-muted/20 rounded">
                            {source.category ?? "industry-news"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={source.enabled}
                            onChange={() => handleToggle(source)}
                            className="cursor-pointer h-3.5 w-3.5 border-border rounded-none text-foreground focus:ring-0 focus:ring-offset-0 accent-foreground"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => startEdit(source)}
                              className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Edit
                            </button>
                            {deleteConfirm === source.id ? (
                              <div className="flex gap-2 items-center">
                                <span className="font-mono text-xs text-muted-foreground">
                                  Delete?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(source.id)}
                                  className="font-mono text-xs text-red-500 hover:underline"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirm(null)}
                                  className="font-mono text-xs hover:underline"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm(source.id)}
                                className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab Content: Ingestion */}
      {activeTab === "ingest" && (
        <section className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-sans text-lg text-foreground">Ingestion Pipeline</h2>
              <p className="font-sans text-xs text-muted-foreground">
                Manually trigger the 9-step parsing, scraping, embedding, clustering, and
                summarizing engine.
              </p>
            </div>
            <button
              type="button"
              onClick={handleIngest}
              disabled={ingestState === "running"}
              className="border border-border px-5 py-2.5 font-mono text-xs uppercase tracking-widest hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {ingestState === "running" ? "Running…" : "Run ingestion"}
            </button>
          </div>

          {/* Dedup panel */}
          <div className="border border-border p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-sans text-sm text-foreground">Deduplicate clusters</p>
              <p className="font-sans text-xs text-muted-foreground mt-0.5">
                Merge clusters with cosine similarity ≥ 0.82, keeping the oldest as canonical.
              </p>
              {dedupMessage && (
                <p
                  className={`font-mono text-xs mt-1 ${dedupState === "error" ? "text-red-500" : "text-muted-foreground"}`}
                >
                  {dedupMessage}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleDedup}
              disabled={dedupState === "running"}
              className="shrink-0 border border-border px-4 py-2 font-mono text-xs uppercase tracking-widest hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {dedupState === "running" ? "Running…" : "Run dedup"}
            </button>
          </div>

          {/* Digest panel */}
          <div className="border border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-sans text-sm text-foreground font-semibold">
                Generate Multi-Scope Digests
              </p>
              <p className="font-sans text-xs text-muted-foreground mt-0.5">
                Synthesize grounded summaries for Daily, Weekly, Monthly, or All-Time Field
                Overview.
              </p>
              {digestMessage && (
                <p
                  className={`font-mono text-xs mt-1 ${digestState === "error" ? "text-red-500" : "text-green-500"}`}
                >
                  {digestMessage}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleGenerateDigest("daily")}
                disabled={digestState === "running"}
                className="border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => handleGenerateDigest("weekly")}
                disabled={digestState === "running"}
                className="border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Weekly
              </button>
              <button
                type="button"
                onClick={() => handleGenerateDigest("monthly")}
                disabled={digestState === "running"}
                className="border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => handleGenerateDigest("overview")}
                disabled={digestState === "running"}
                className="border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => handleGenerateDigest("all")}
                disabled={digestState === "running"}
                className="border border-foreground bg-foreground text-background px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider hover:bg-foreground/90 disabled:opacity-50 font-semibold transition-colors"
              >
                {digestState === "running" ? "Seeding…" : "Seed All"}
              </button>
            </div>
          </div>

          {/* Email Digest panel */}
          <div className="border border-border p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-sans text-sm text-foreground">Send Email Digest</p>
              <p className="font-sans text-xs text-muted-foreground mt-0.5">
                Trigger immediate email dispatch of the latest daily digest and past 24h stories to
                test recipients.
              </p>
              {emailMessage && (
                <p
                  className={`font-mono text-xs mt-1 ${emailState === "error" ? "text-red-500" : "text-green-500"}`}
                >
                  {emailMessage}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={emailState === "running"}
              className="shrink-0 border border-border px-4 py-2 font-mono text-xs uppercase tracking-widest hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {emailState === "running" ? "Sending…" : "Send Test Email"}
            </button>
          </div>

          {ingestState !== "idle" && (
            <div className="border border-border bg-card">
              <div className="border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Console Output
              </div>
              <div
                ref={logContainerRef}
                className="h-80 overflow-y-auto p-4 font-mono text-[11px] space-y-1 bg-black text-green-400 selection:bg-green-800 selection:text-white"
              >
                {ingestLog.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.startsWith("Step ")
                        ? "text-white font-semibold mt-3 first:mt-0 text-xs border-b border-zinc-800 pb-1"
                        : isIngestErrorLine(line)
                          ? "bg-red-950/90 text-red-200 px-2 py-0.5 rounded border-l-2 border-red-500 font-medium"
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
                <div className="border-t border-border px-4 py-3 bg-muted/10 grid grid-cols-2 sm:grid-cols-6 gap-4 font-mono text-xs text-muted-foreground">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground/60 uppercase">Sources</span>
                    <span className="font-semibold text-foreground text-sm mt-0.5">
                      {ingestStats.sources}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground/60 uppercase">
                      URLs Found
                    </span>
                    <span className="font-semibold text-foreground text-sm mt-0.5">
                      {ingestStats.urls_found}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground/60 uppercase">
                      New Scraped
                    </span>
                    <span className="font-semibold text-foreground text-sm mt-0.5">
                      {ingestStats.new_articles}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground/60 uppercase">
                      Discarded
                    </span>
                    <span className="font-semibold text-foreground text-sm mt-0.5">
                      {ingestStats.discarded}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground/60 uppercase">Clusters</span>
                    <span className="font-semibold text-foreground text-sm mt-0.5">
                      {ingestStats.clusters_created}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground/60 uppercase">Duration</span>
                    <span className="font-semibold text-foreground text-sm mt-0.5">
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
