/**
 * Queue loading state.
 *
 * Mirrors the real layout — tabs, then a table of rows — so the page does not
 * jump when the data lands. The status text is what a screen reader announces;
 * the boxes themselves are hidden from it.
 */
import { Skeleton } from '@/components/skeleton';

export default function DriversQueueLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-6xl space-y-6">
      <span className="sr-only">Loading the review queue…</span>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-80" />
        </div>
        <Skeleton className="h-10 w-80" />
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="space-y-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
