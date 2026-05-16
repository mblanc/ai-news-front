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

interface EditDraft {
  name: string
  url: string
  type: SourceType
}

export default function SourcesPage() {
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
      if (!r.ok) throw new Error("Failed to add source")
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
      const r = await apiFetch(`/api/sources/${id}`, {
        method: "PATCH",
        body: JSON.stringify(editDraft),
      })
      if (!r.ok) throw new Error("Failed to save")
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

  const inputCls =
    "border border-border bg-background px-2 py-1 font-mono text-xs outline-none focus:border-foreground w-full"

  return (
    <div className="space-y-10">
      {/* ── Ingest panel ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-sm uppercase tracking-widest">Ingestion</h2>
          <button
            type="button"
            onClick={handleIngest}
            disabled={ingestState === "running"}
            className="border border-border px-4 py-2 font-mono text-xs uppercase tracking-widest hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ingestState === "running" ? "Running…" : "Run ingestion"}
          </button>
        </div>

        {ingestState !== "idle" && (
          <div className="border border-border">
            <div
              ref={logContainerRef}
              className="h-72 overflow-y-auto p-3 font-mono text-xs space-y-0.5 bg-muted/30"
            >
              {ingestLog.map((line, i) => (
                <div
                  key={i}
                  className={
                    line.startsWith("Step ")
                      ? "text-foreground font-semibold mt-2 first:mt-0"
                      : line.startsWith("Error") || line.startsWith("Fatal")
                        ? "text-red-500"
                        : "text-muted-foreground"
                  }
                >
                  {line}
                </div>
              ))}
              {ingestState === "running" && (
                <div className="text-muted-foreground animate-pulse">▌</div>
              )}
            </div>

            {ingestStats && (
              <div className="border-t border-border px-3 py-2 flex flex-wrap gap-4 font-mono text-xs text-muted-foreground">
                <span>Sources: {ingestStats.sources}</span>
                <span>URLs: {ingestStats.urls_found}</span>
                <span>New: {ingestStats.new_articles}</span>
                <span>Discarded: {ingestStats.discarded}</span>
                <span>Clusters: {ingestStats.clusters_created}</span>
                <span>{(ingestStats.duration_ms / 1000).toFixed(1)}s</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Sources table ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-sm uppercase tracking-widest">Sources</h2>
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="border border-border px-4 py-2 font-mono text-xs uppercase tracking-widest hover:bg-muted"
          >
            {showAdd ? "Cancel" : "Add source"}
          </button>
        </div>

        {error && <p className="font-mono text-xs text-red-500 mb-4">{error}</p>}

        {showAdd && (
          <form onSubmit={handleAdd} className="flex gap-2 mb-6">
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
              className="border border-border px-4 py-2 font-mono text-xs uppercase tracking-widest hover:bg-muted disabled:opacity-50"
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
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 text-left font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Name
                </th>
                <th className="py-2 text-left font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  URL
                </th>
                <th className="py-2 text-left font-mono text-xs uppercase tracking-widest text-muted-foreground w-20">
                  Type
                </th>
                <th className="py-2 text-left font-mono text-xs uppercase tracking-widest text-muted-foreground w-16">
                  On
                </th>
                <th className="py-2 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) =>
                editingId === source.id && editDraft ? (
                  <tr key={source.id} className="border-b border-border bg-muted/20">
                    <td className="py-2 pr-2">
                      <input
                        className={inputCls}
                        value={editDraft.name}
                        onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                        placeholder="Name"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        className={inputCls}
                        value={editDraft.url}
                        onChange={(e) => setEditDraft({ ...editDraft, url: e.target.value })}
                        placeholder="https://…"
                      />
                    </td>
                    <td className="py-2 pr-2">
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
                    <td />
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(source.id)}
                          disabled={saving}
                          className="font-mono text-xs hover:underline disabled:opacity-50"
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
                  <tr key={source.id} className="border-b border-border">
                    <td className="py-3 pr-4 font-sans text-sm">{source.name}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground max-w-xs truncate">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {source.url}
                      </a>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="border border-border px-2 py-0.5 font-mono text-xs uppercase tracking-widest">
                        {source.type}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        type="checkbox"
                        checked={source.enabled}
                        onChange={() => handleToggle(source)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="py-3">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => startEdit(source)}
                          className="font-mono text-xs text-muted-foreground hover:text-foreground"
                        >
                          Edit
                        </button>
                        {deleteConfirm === source.id ? (
                          <div className="flex gap-2 items-center">
                            <span className="font-mono text-xs text-muted-foreground">Delete?</span>
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
                            className="font-mono text-xs text-muted-foreground hover:text-foreground"
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
        )}
      </section>
    </div>
  )
}
