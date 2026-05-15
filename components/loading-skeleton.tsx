import { Skeleton } from "@/components/ui/skeleton"

export function LoadingSkeleton() {
  return (
    <div className="space-y-10">
      {Array.from({ length: 3 }).map((_, section) => (
        <div key={section}>
          <div className="border-b border-border pb-2 mb-0 flex items-baseline justify-between">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border-b border-border py-4 last:border-b-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-7 w-20 shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
