/**
 * Review-screen loading state.
 *
 * Holds the two-column shape of the real page, decision panel included, so the
 * Approve button does not slide under the reviewer's cursor as the data lands.
 */
import { Skeleton, SkeletonCard } from '@/components/skeleton';

export default function DriverReviewLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-5xl space-y-6">
      <span className="sr-only">Loading the application…</span>

      <Skeleton className="h-4 w-36" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-3 w-80" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <SkeletonCard lines={5} />
          <SkeletonCard lines={3} />
        </div>
        <div className="space-y-6">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
        </div>
      </div>

      <SkeletonCard lines={6} />
    </div>
  );
}
