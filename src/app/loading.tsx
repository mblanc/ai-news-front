import { LoadingSkeleton } from "@/components/loading-skeleton"

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-6">
      <LoadingSkeleton />
    </div>
  )
}
