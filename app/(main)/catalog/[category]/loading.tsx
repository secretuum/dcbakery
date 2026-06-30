import { Skeleton } from "@/src/components/ui/Skeleton";

export default function CategoryLoading() {
  return (
    <main className="min-h-screen bg-cream text-dark">
      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <Skeleton className="h-5 w-32 rounded-badge" />
        <Skeleton className="mt-4 h-16 max-w-xl" />
        <Skeleton className="mt-4 h-16 max-w-2xl" />

        <div className="mt-8 flex gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-32 rounded-btn" />
          ))}
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="overflow-hidden rounded-card bg-white shadow-sm">
              <Skeleton className="aspect-square rounded-none" />
              <div className="space-y-4 p-5">
                <Skeleton className="h-6 w-32 rounded-badge" />
                <Skeleton className="h-14" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12 rounded-btn" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
