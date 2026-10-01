import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto compartido: la carcasa que Next puede pintar sin datos ni red. */
export function ScreenSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md md:max-w-3xl lg:max-w-5xl px-5 pb-12 pt-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="size-11 shrink-0 rounded-full" />
      </div>

      <Skeleton className="mt-8 h-44 w-full rounded-xl" />

      <div className="mt-8 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
