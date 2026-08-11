import { Skeleton } from "@/src/components/ui/Skeleton";

export default function ProductLoading() {
  return (
    <main className="min-h-screen bg-cream text-dark">
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-14">
        <div className="space-y-4">
          <Skeleton className="aspect-square" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="aspect-square rounded-btn" />
            ))}
          </div>
        </div>
        <div>
          <Skeleton className="h-7 w-48 rounded-badge" />
          <Skeleton className="mt-5 h-20 max-w-xl" />
          <Skeleton className="mt-5 h-24 max-w-2xl" />
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-24" />
            ))}
          </div>
          <Skeleton className="mt-6 h-72" />
        </div>
      </section>
    </main>
  );
}
