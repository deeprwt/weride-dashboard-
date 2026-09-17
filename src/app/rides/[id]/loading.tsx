/**
 * Ride-detail loading state.
 *
 * Holds the two-column shape of the real page, intervention panel included, so
 * the Cancel button does not slide under the operator's cursor as the data
 * lands — on this screen that would mean cancelling the wrong thing.
 */
import { Skeleton, SkeletonCard } from '@/components/skeleton';

export default function RideDetailLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-6xl space-y-6">
      <span className="sr-only">Loading the ride…</span>

      <Skeleton className="h-4 w-36" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-72" />
        <Skeleton className="h-3 w-96" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={6} />
        </div>
        <div className="space-y-6">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={4} />
        </div>
      </div>

      <SkeletonCard lines={8} />
    </div>
  );
}
