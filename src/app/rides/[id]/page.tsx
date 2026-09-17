/**
 * One ride, in full — the screen dispatch is debugged from.
 *
 * Server Component. Everything is resolved here with the cookie-bound session;
 * the one Client Component receives ids, a candidate list and two booleans,
 * never a token.
 *
 * The event trail is the point of this page. A rider says nobody came; a driver
 * says the ride vanished; a fare is disputed. `rides.status` answers none of
 * that, because it is one mutable column — the trail is the ordered, timestamped
 * record of what the platform actually did, and it is rendered here verbatim,
 * metadata included, rather than summarised into something friendlier that
 * would leave the operator guessing.
 */
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ApiError, adminRideDetailPath } from '@uride/api-client';
import {
  isInFlightRideStatus,
  type AdminRideDetail,
  type AdminRideOffer,
  type RideEvent,
} from '@uride/types';
import { cn } from '@uride/ui-web';
import { apiServerFetch } from '@/lib/api-server';
import { EmptyState } from '@/components/empty-state';
import { ErrorPanel } from '@/components/error-panel';
import { Badge, OfferStatusBadge, RideStatusBadge } from '@/components/status-badge';
import {
  eventActorLabel,
  formatDateTime,
  formatDistanceMeters,
  formatDuration,
  formatMoneyCents,
  formatPhone,
  formatTimeOfDay,
  offerDeclineReasonLabel,
  rideClassLabel,
  rideEventLabel,
  rideStatusLabel,
  secondsBetween,
} from '@/components/format';
import { RideActions } from './ride-actions';

export const metadata: Metadata = {
  title: 'Ride · WeRide Admin',
};

export default async function RideDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let detail: AdminRideDetail;
  try {
    detail = await apiServerFetch<AdminRideDetail>(adminRideDetailPath(id));
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect('/login');
    }
    const notFound = err instanceof ApiError && err.status === 404;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return (
      <div className="mx-auto max-w-6xl">
        <ErrorPanel
          title={notFound ? 'No such ride' : 'Unable to load this ride'}
          message={notFound ? 'This ride does not exist, or the link is wrong.' : message}
          action={<BackLink />}
        />
      </div>
    );
  }

  const { ride, rider, driver, events, offers, candidates } = detail;
  const inFlight = isInFlightRideStatus(ride.status);
  // The log is the truth and `rides.status` is a cache of it. When they differ,
  // something moved the ride without going through the state machine — which is
  // a bug report, not a display quirk, so it is stated at the top of the page.
  const diverged = detail.replayedStatus !== null && detail.replayedStatus !== ride.status;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <BackLink />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight">
              {rider.fullName ?? 'Unnamed rider'} → {ride.dropoffAddress}
            </h2>
            <RideStatusBadge status={ride.status} />
            {inFlight && (
              <Badge tone="info">
                <span
                  aria-hidden="true"
                  className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-info-500"
                />
                In flight · {formatDuration(ride.ageSeconds)}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {rideClassLabel(ride.rideClass)} · requested{' '}
            <time dateTime={ride.requestedAt}>{formatDateTime(ride.requestedAt)}</time> ·{' '}
            {formatMoneyCents(ride.fareCents, ride.currency)}
          </p>
          <p className="mt-1 font-mono text-xs text-text-muted">{ride.id}</p>
        </div>
      </header>

      {diverged && (
        <Callout
          tone="danger"
          title="This ride's status does not match its event log"
          body={`The ride row says ${rideStatusLabel(ride.status)}; replaying every event says ${
            detail.replayedStatus ? rideStatusLabel(detail.replayedStatus) : 'nothing at all'
          }. Something changed this ride outside the state machine — capture this page before acting on it.`}
        />
      )}

      {ride.status === 'no_drivers_found' && (
        <Callout
          tone="danger"
          title="Dispatch gave up on this ride"
          body={`No driver accepted after ${ride.dispatchRound} wave${
            ride.dispatchRound === 1 ? '' : 's'
          } and ${ride.offerCount} offer${
            ride.offerCount === 1 ? '' : 's'
          }. The rider was told nobody was coming.`}
        />
      )}

      {detail.cancelReason && (
        <Callout
          tone="neutral"
          title={`Cancelled by ${detail.cancelledBy ? eventActorLabel(detail.cancelledBy).toLowerCase() : 'someone'}`}
          body={`Reason recorded: ${detail.cancelReason.replace(/_/g, ' ')}.`}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section
            aria-labelledby="route-heading"
            className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
          >
            <h3 id="route-heading" className="text-base font-semibold">
              Route
            </h3>
            <ol className="mt-4 space-y-4">
              <Waypoint
                label="Pickup"
                address={ride.pickupAddress}
                lat={detail.pickup.lat}
                lng={detail.pickup.lng}
              />
              <Waypoint
                label="Drop-off"
                address={ride.dropoffAddress}
                lat={detail.dropoff.lat}
                lng={detail.dropoff.lng}
              />
            </ol>
            <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <Detail label="Quoted distance" value={formatDistanceMeters(ride.distanceMeters)} />
              <Detail label="Quoted duration" value={formatDuration(ride.durationSeconds)} />
              <Detail
                label="Actual distance"
                value={formatDistanceMeters(detail.actualDistanceMeters)}
              />
            </dl>
          </section>

          <section
            aria-labelledby="parties-heading"
            className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
          >
            <h3 id="parties-heading" className="text-base font-semibold">
              Who is on this ride
            </h3>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Rider</p>
                <p className="mt-1 font-medium">{rider.fullName ?? 'Unnamed rider'}</p>
                <p className="text-sm text-text-muted">{formatPhone(rider.phone)}</p>
                <p className="text-sm text-text-muted">{rider.email ?? 'No email'}</p>
                <Link
                  href={`/rides?riderId=${rider.id}` as Route}
                  className="mt-2 inline-flex text-xs text-text-muted underline-offset-2 hover:text-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  All rides by this rider
                </Link>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Driver</p>
                {driver ? (
                  <>
                    <p className="mt-1 font-medium">{driver.fullName ?? 'Unnamed driver'}</p>
                    <p className="text-sm text-text-muted">{formatPhone(driver.phone)}</p>
                    <p className="text-sm text-text-muted">
                      {driver.vehicleDescription ?? 'No vehicle on the ride'}
                      {driver.vehiclePlate ? ` · ${driver.vehiclePlate}` : ''}
                      {driver.vehicleColor ? ` · ${driver.vehicleColor}` : ''}
                    </p>
                    <p className="text-sm text-text-muted">
                      {driver.ratingAvg === null
                        ? 'No ratings yet'
                        : `${driver.ratingAvg.toFixed(2)} · ${driver.ratingCount} ratings`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <Link
                        href={`/drivers/${driver.id}` as Route}
                        className="inline-flex text-xs text-text-muted underline-offset-2 hover:text-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        Driver file
                      </Link>
                      <Link
                        href={`/rides?driverId=${driver.id}` as Route}
                        className="inline-flex text-xs text-text-muted underline-offset-2 hover:text-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        All rides by this driver
                      </Link>
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-text-muted">
                    Nobody is assigned. {ride.pendingOfferCount > 0
                      ? `${ride.pendingOfferCount} offer${
                          ride.pendingOfferCount === 1 ? ' is' : 's are'
                        } still out.`
                      : 'No offer is outstanding.'}
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <RideActions
            rideId={ride.id}
            candidates={candidates}
            canReassign={detail.canReassign}
            canCancel={detail.canCancel}
            hasDriver={driver !== null}
          />
          <DispatchSummary detail={detail} />
        </div>
      </div>

      <section aria-labelledby="timeline-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="timeline-heading" className="text-base font-semibold">
            Event trail
          </h3>
          <p className="text-sm text-text-muted">
            {events.length} event{events.length === 1 ? '' : 's'} · oldest first
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface shadow-sm">
          {events.length === 0 ? (
            <EmptyState
              title="No events recorded"
              description="Every ride gets a genesis event when it is created, so an empty trail means this ride was written outside the state machine."
            />
          ) : (
            <ol className="divide-y divide-border">
              {events.map((event, index) => (
                <EventRow
                  key={event.id}
                  event={event}
                  previous={index > 0 ? events[index - 1] : undefined}
                  first={events[0]}
                />
              ))}
            </ol>
          )}
        </div>
      </section>

      <section aria-labelledby="offers-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="offers-heading" className="text-base font-semibold">
            Offers
          </h3>
          <p className="text-sm text-text-muted">
            {offers.length} offer{offers.length === 1 ? '' : 's'} across {ride.dispatchRound} wave
            {ride.dispatchRound === 1 ? '' : 's'}
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          {offers.length === 0 ? (
            <EmptyState
              title="No offer has been made"
              description="Either the dispatcher has not reached this ride yet, or it found nobody within the search radius."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Every offer made for this ride, oldest first</caption>
                <thead className="border-b border-border bg-surface-muted/60 text-xs uppercase tracking-wide text-text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Driver
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Wave
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Distance
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      ETA
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Offered
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Answered
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Outcome
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {offers.map((offer) => (
                    <OfferRow key={offer.id} offer={offer} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * One event.
 *
 * Two elapsed times, because a dispatch bug is almost always a question about
 * one of them: since the previous event (how long did this step take) and since
 * the ride was requested (how long had the rider been waiting when it happened).
 */
function EventRow({
  event,
  previous,
  first,
}: {
  event: RideEvent;
  previous: RideEvent | undefined;
  first: RideEvent | undefined;
}) {
  const sincePrevious = previous ? secondsBetween(previous.createdAt, event.createdAt) : null;
  const sinceStart = first ? secondsBetween(first.createdAt, event.createdAt) : null;

  return (
    <li className="flex gap-4 px-4 py-3">
      <div className="w-28 shrink-0 text-right">
        <time dateTime={event.createdAt} className="block text-sm tabular-nums text-text">
          {formatTimeOfDay(event.createdAt)}
        </time>
        <span className="block text-xs tabular-nums text-text-muted">
          {sinceStart === null ? 'start' : `+${formatDuration(sinceStart)}`}
        </span>
      </div>

      <div className="relative shrink-0 pt-1.5" aria-hidden="true">
        <span className="block h-2 w-2 rounded-full bg-primary" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text">
          {rideEventLabel(event.type)}
          {event.toStatus && (
            <span className="ml-2 font-normal text-text-muted">
              {event.fromStatus ? `${rideStatusLabel(event.fromStatus)} → ` : ''}
              {rideStatusLabel(event.toStatus)}
            </span>
          )}
          {!event.toStatus && event.fromStatus && (
            <span className="ml-2 font-normal text-text-muted">
              status unchanged ({rideStatusLabel(event.fromStatus)})
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {eventActorLabel(event.actorType)}
          {event.actorId ? <span className="font-mono"> · {event.actorId}</span> : ''}
          {sincePrevious !== null ? ` · ${formatDuration(sincePrevious)} after the previous event` : ''}
        </p>
        <MetadataList metadata={event.metadata} />
      </div>
    </li>
  );
}

function OfferRow({ offer }: { offer: AdminRideOffer }) {
  const answerSeconds = secondsBetween(offer.offeredAt, offer.respondedAt);

  return (
    <tr className="align-middle">
      <th scope="row" className="px-4 py-3 font-normal">
        <Link
          href={`/drivers/${offer.driver.id}` as Route}
          className="font-medium text-text underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {offer.driver.fullName ?? 'Unnamed driver'}
        </Link>
      </th>
      <td className="px-4 py-3 tabular-nums text-text-muted">{offer.round}</td>
      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-text-muted">
        {formatDistanceMeters(offer.distanceMeters)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-text-muted">
        {formatDuration(offer.etaSeconds)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-text-muted">
        <time dateTime={offer.offeredAt}>{formatTimeOfDay(offer.offeredAt)}</time>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-text-muted">
        {offer.respondedAt ? (
          <>
            <time dateTime={offer.respondedAt}>{formatTimeOfDay(offer.respondedAt)}</time>
            {answerSeconds !== null && (
              <span className="block text-xs tabular-nums">
                {formatDuration(answerSeconds)} to answer
              </span>
            )}
          </>
        ) : (
          <span className="text-text-muted/70">Never</span>
        )}
      </td>
      <td className="px-4 py-3">
        <OfferStatusBadge status={offer.status} />
        {offer.declineReason && (
          <span className="mt-1 block text-xs text-text-muted">
            {offerDeclineReasonLabel(offer.declineReason)}
          </span>
        )}
      </td>
    </tr>
  );
}

/** The numbers an operator checks before deciding whether dispatch is at fault. */
function DispatchSummary({ detail }: { detail: AdminRideDetail }) {
  const { ride } = detail;
  const stages: { label: string; at: string | null }[] = [
    { label: 'Requested', at: ride.requestedAt },
    { label: 'Accepted', at: ride.acceptedAt },
    { label: 'Trip started', at: ride.startedAt },
    { label: 'Completed', at: ride.completedAt },
    { label: 'Cancelled', at: ride.cancelledAt },
  ];

  return (
    <section
      aria-labelledby="dispatch-heading"
      className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <h3 id="dispatch-heading" className="text-base font-semibold">
        Dispatch
      </h3>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <Detail label="Waves run" value={String(ride.dispatchRound)} />
        <Detail label="Offers made" value={String(ride.offerCount)} />
        <Detail label="Offers still out" value={String(ride.pendingOfferCount)} />
        <Detail
          label="Time to a driver"
          value={formatDuration(secondsBetween(ride.requestedAt, ride.acceptedAt))}
        />
      </dl>

      <ul className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
        {stages
          .filter((stage) => stage.at !== null)
          .map((stage) => (
            <li key={stage.label} className="flex items-baseline justify-between gap-3">
              <span className="text-text-muted">{stage.label}</span>
              <time dateTime={stage.at ?? undefined} className="tabular-nums text-text">
                {formatTimeOfDay(stage.at)}
              </time>
            </li>
          ))}
      </ul>
    </section>
  );
}

function Waypoint({
  label,
  address,
  lat,
  lng,
}: {
  label: string;
  address: string;
  lat: number;
  lng: number;
}) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
        <p className="font-medium">{address}</p>
        {/* Coordinates, not a map: a map tile provider is the first billable
            dependency, and an operator comparing a pickup pin against a driver's
            ping needs the numbers anyway. */}
        <p className="font-mono text-xs text-text-muted">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
      </div>
    </li>
  );
}

/**
 * Event metadata, rendered as it was written.
 *
 * Deliberately generic. The backend adds fields to these payloads as dispatch
 * grows, and an allowlist here would silently hide the one field somebody added
 * precisely because they were debugging this screen.
 */
function MetadataList({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata) return null;
  const entries = Object.entries(metadata).filter(([, value]) => value !== null && value !== '');
  if (entries.length === 0) return null;

  return (
    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-1">
          <dt>{humaniseKey(key)}:</dt>
          <dd className="font-mono text-text">{renderMetadataValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function humaniseKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1').replace(/[_.]/g, ' ').trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function renderMetadataValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-text-muted">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function Callout({
  tone,
  title,
  body,
}: {
  tone: 'danger' | 'neutral';
  title: string;
  body: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3',
        tone === 'danger'
          ? 'border-danger-500/40 bg-danger-500/5'
          : 'border-border bg-surface-muted/50',
      )}
    >
      <p className="text-sm font-medium text-text">{title}</p>
      <p className="mt-1 text-sm text-text-muted">{body}</p>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/rides"
      className="inline-flex items-center gap-1 text-sm text-text-muted underline-offset-2 transition hover:text-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span aria-hidden="true">←</span> Back to the board
    </Link>
  );
}
