/**
 * Board loading state.
 *
 * Mirrors the real layout — tabs, then a table of rows — so the page does not
 * jump when the data lands. The status text is what a screen reader announces;
 * the boxes themselves are hidden from it.
 */
import { Skeleton } from '@/components/skeleton';

export default function RidesBoardLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-7xl space-y-6">
      <span className="sr-only">Loading the dispatch board…</span>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-96" />
        </div>
        <Skeleton className="h-8 w-64 rounded-full" />
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-32 rounded-full" />
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="space-y-3">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
