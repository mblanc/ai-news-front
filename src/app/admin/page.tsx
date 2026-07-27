"use client"

import { useEffect, useRef, useState } from "react"
import type { Source, SourceType } from "@/lib/types"
import type { IngestStats } from "@/lib/ingest"

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
}

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

  const [ingestState, setIngestState] = useState<IngestState>("idle")
  const [ingestLog, setIngestLog] = useState<string[]>([])
  const [ingestStats, setIngestStats] = useState<IngestStats | null>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)

  const [dedupState, setDedupState] = useState<DedupState>("idle")
  const [dedupMessage, setDedupMessage] = useState<string | null>(null)

  const [sortField, setSortField] = useState<"name" | "url" | "type" | "enabled" | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const handleSort = (field: "name" | "url" | "type" | "enabled") => {
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

  const sortedSources = [...sources].sort((a, b) => {
    if (!sortField) return 0

    let aValue = a[sortField]
    let bValue = b[sortField]

    if (aValue === undefined || aValue === null) aValue = ""
    if (bValue === undefined || bValue === null) bValue = ""

    if (typeof aValue === "boolean" && typeof bValue === "boolean") {
      if (aValue === bValue) return 0
      return sortDirection === "asc" ? (aValue ? 1 : -1) : (aValue ? -1 : 1)
    }

    const aStr = String(aValue).toLowerCase()
    const bStr = String(bValue).toLowerCase()

    if (aStr < bStr) return sortDirection === "asc" ? -1 : 1
    if (aStr > bStr) return sortDirection === "asc" ? 1 : -1
    return 0
  })

  const renderSortIcon = (field: "name" | "url" | "type" | "enabled") => {
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
    if (!url) return
    setAdding(true)
    try {
      const r = await apiFetch("/api/sources", {
        method: "POST",
        body: JSON.stringify({ url, name }),
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
    setEditDraft({ name: source.name ?? "", url: source.url, type: source.type })
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-sans text-lg text-foreground">News Sources</h2>
              <p className="font-sans text-xs text-muted-foreground">
                Manage the active RSS feeds and websites scraped hourly.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="border border-border px-4 py-2 font-mono text-xs uppercase tracking-widest hover:bg-muted transition-colors"
            >
              {showAdd ? "Cancel" : "Add source"}
            </button>
          </div>

          {showAdd && (
            <form
              onSubmit={handleAdd}
              className="flex gap-2 p-4 border border-border bg-muted/10 animate-slide-down"
            >
              <input
                ref={urlRef}
                type="url"
                required
                placeholder="https://example.com/feed.xml"
                className="flex-1 border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-foreground"
              />
              <input
                ref={nameRef}
                type="text"
                placeholder="Name (auto-detected)"
                className="w-48 border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-foreground"
              />
              <button
                type="submit"
                disabled={adding}
                className="border border-border px-4 py-2 font-mono text-xs uppercase tracking-widest hover:bg-muted disabled:opacity-50 transition-colors"
              >
                {adding ? "Saving…" : "Save"}
              </button>
            </form>
          )}

          {sources.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">
              No sources yet. Add a URL above to get started.
            </p>
          ) : (
            <div className="border border-border">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/10">
                    <th
                      onClick={() => handleSort("name")}
                      className="py-2.5 px-4 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground select-none group"
                    >
                      <span className="flex items-center gap-1">
                        Name {renderSortIcon("name")}
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort("url")}
                      className="py-2.5 px-4 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground select-none group"
                    >
                      <span className="flex items-center gap-1">
                        URL {renderSortIcon("url")}
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort("type")}
                      className="py-2.5 px-4 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground w-28 cursor-pointer hover:text-foreground select-none group"
                    >
                      <span className="flex items-center gap-1">
                        Type {renderSortIcon("type")}
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort("enabled")}
                      className="py-2.5 px-4 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground w-20 cursor-pointer hover:text-foreground select-none group"
                    >
                      <span className="flex items-center gap-1">
                        On {renderSortIcon("enabled")}
                      </span>
                    </th>
                    <th className="py-2.5 px-4 w-32"></th>
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
                Manually trigger the 8-step parsing, scraping, embedding, clustering, and
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
                        : line.startsWith("Error") || line.startsWith("Fatal")
                          ? "text-red-400"
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
