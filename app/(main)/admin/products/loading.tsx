import { Skeleton } from "@/src/components/ui/Skeleton";

export default function AdminProductsLoading() {
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-3 w-16 rounded-badge" />
          <Skeleton className="mt-3 h-10 w-52 rounded-card" />
          <Skeleton className="mt-3 h-4 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-32 rounded-btn" />
          <Skeleton className="h-11 w-28 rounded-btn" />
        </div>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-card" />
        ))}
      </div>

      <Skeleton className="mt-6 h-28 rounded-card" />

      <div className="mt-6 overflow-hidden rounded-card bg-white shadow-sm">
        <div className="h-14 animate-pulse bg-coral-light/50" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-start gap-5 border-t border-black/10 px-5 py-4">
            <Skeleton className="size-28 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-9 w-full max-w-xs rounded-xl" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-9 w-full max-w-xs rounded-xl" />
            </div>
            <div className="space-y-2 pt-1">
              <Skeleton className="h-9 w-24 rounded-xl" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="pt-1">
              <Skeleton className="h-9 w-28 rounded-xl" />
            </div>
            <div className="pt-1">
              <Skeleton className="h-10 w-24 rounded-btn" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
