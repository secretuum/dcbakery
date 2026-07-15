import { Skeleton } from "@/src/components/ui/Skeleton";

export default function AdminOrdersLoading() {
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-3 w-16 rounded-badge" />
          <Skeleton className="mt-2 h-12 w-44 rounded-card" />
          <Skeleton className="mt-3 h-4 w-72" />
        </div>
        <Skeleton className="h-11 w-28 rounded-btn" />
      </div>

      <div className="mt-7 flex gap-2 overflow-x-auto pb-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-btn" />
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-card border border-black/10 bg-white">
        <div className="h-10 border-b border-black/10 bg-cream" />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-black/10 px-4 py-3">
            <Skeleton className="h-4 w-20" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-28 rounded-btn" />
            <Skeleton className="h-5 w-16 rounded-btn" />
          </div>
        ))}
      </div>
    </div>
  );
}
