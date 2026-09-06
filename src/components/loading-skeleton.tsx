import { Skeleton } from "@/components/ui/skeleton"

export function LoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading stories"
      aria-live="polite"
      aria-busy="true"
      className="space-y-6"
    >
      <span className="sr-only">Loading stories and cluster synthesis...</span>
      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section} className="space-y-2.5">
          <div className="flex items-baseline justify-between border-b border-border/80 pb-1.5">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-3.5 w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/70 bg-card p-3.5 shadow-xs space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-20 rounded-full" />
                    <Skeleton className="h-3.5 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-4 rounded-full" />
                </div>
                <div className="flex items-start gap-2.5">
                  <Skeleton className="h-6 w-6 rounded-full shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-4/5 rounded-md" />
                    <Skeleton className="h-3 w-full rounded-md" />
                    <Skeleton className="h-3 w-2/3 rounded-md" />
                  </div>
                </div>
                <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-3.5 w-28 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
