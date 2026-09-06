"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Command } from "lucide-react"

interface KeyboardShortcutsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ShortcutItem {
  keys: string[]
  description: string
}

const SHORTCUT_GROUPS: { group: string; items: ShortcutItem[] }[] = [
  {
    group: "Story Navigation",
    items: [
      { keys: ["J", "↓"], description: "Move down to next story cluster" },
      { keys: ["K", "↑"], description: "Move up to previous story cluster" },
      { keys: ["Enter", "O"], description: "Open AI synthesis briefing & takeaways" },
      { keys: ["Esc"], description: "Close briefing modal or clear selection" },
    ],
  },
  {
    group: "Search & Filtering",
    items: [
      { keys: ["/"], description: "Focus search bar" },
      { keys: ["Esc"], description: "Blur search bar or clear current query" },
      { keys: ["?"], description: "Toggle this keyboard shortcuts cheatsheet" },
    ],
  },
]

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="w-full sm:max-w-md p-5 rounded-2xl border border-border/80 bg-card shadow-2xl"
      >
        <DialogHeader className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Command className="h-4 w-4" />
            </span>
            <DialogTitle className="font-display text-base font-bold text-foreground">
              Keyboard Shortcuts
            </DialogTitle>
          </div>
          <DialogDescription className="font-sans text-xs text-muted-foreground">
            Fast accelerators for power readers scanning high-volume intelligence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {SHORTCUT_GROUPS.map((sec) => (
            <div key={sec.group} className="space-y-2">
              <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {sec.group}
              </h4>
              <div className="space-y-1.5">
                {sec.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border/50 text-xs"
                  >
                    <span className="font-sans text-foreground/90">{item.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="min-w-[22px] px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold text-foreground bg-background border border-border rounded shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
