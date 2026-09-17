/**
 * Loading placeholder.
 *
 * Shaped like the content it replaces so a slow queue does not reflow the page
 * out from under a reviewer who has already started reaching for a row.
 * `aria-hidden` throughout: the live region that matters is the `role="status"`
 * wrapper each loading.tsx puts around these, not twenty empty grey boxes.
 */
import { cn } from '@uride/ui-web';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-surface-muted', className)}
    />
  );
}

/** A card-shaped block of skeleton lines, matching the review screen's sections. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <Skeleton className="h-4 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className="h-3 w-full max-w-md" />
        ))}
      </div>
    </div>
  );
}
