import { Skeleton } from "@/src/components/ui/Skeleton";

export default function CatalogLoading() {
  return (
    <main className="min-h-screen bg-cream text-dark">
      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <Skeleton className="h-5 w-40 rounded-badge" />
        <Skeleton className="mt-4 h-16 max-w-2xl" />
        <Skeleton className="mt-4 h-20 max-w-3xl" />

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="min-h-72" />
          ))}
        </div>
      </section>
    </main>
  );
}
