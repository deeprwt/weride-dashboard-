/**
 * The live dispatch board.
 *
 * Server Component: the rides, the riders' names and the drivers' names are
 * fetched with the bearer token from the httpOnly cookie and rendered to HTML,
 * so nothing about anybody's trip passes through a client-side store. The only
 * JavaScript this page ships is the refresh heartbeat.
 *
 * All board state lives in the URL — tab, rider, driver, page — so an operator
 * can send a colleague a link to exactly the thing they are looking at, and the
 * Back button behaves the way they expect. It is also what makes auto-refresh
 * safe: a refresh re-renders the same URL, so nothing an operator has selected
 * can be reset by a tick.
 */
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ADMIN_RIDES_PATH, ApiError } from '@uride/api-client';
import {
  ADMIN_RIDE_FILTERS,
  ADMIN_RIDE_FILTER_NAMES,
  RIDE_TRANSITIONS,
  isAdminRideFilter,
  isInFlightRideStatus,
  type AdminRideFilter,
  type AdminRideListItem,
  type AdminRideListPage,
  type RideStatus,
} from '@uride/types';
import { cn } from '@uride/ui-web';
import { apiServerFetch } from '@/lib/api-server';
import { EmptyState } from '@/components/empty-state';
import { ErrorPanel } from '@/components/error-panel';
import { RideStatusBadge } from '@/components/status-badge';
import {
  adminRideFilterLabel,
  formatDateTime,
  formatDuration,
  formatMoneyCents,
  formatTimeOfDay,
  rideClassLabel,
  rideStatusLabel,
} from '@/components/format';
import { AutoRefresh } from './auto-refresh';

export const metadata: Metadata = {
  title: 'Rides · WeRide Admin',
};

const PAGE_SIZE = 25;

/**
 * How long a rider may go unmatched before the board says so in red.
 *
 * Two minutes is roughly four dispatch waves at the default offer TTL: past
 * that, the ladder has widened as far as it usefully goes and the ride is
 * either going to fail or needs a human. It is a display threshold only —
 * nothing on the server reads it.
 */
const STUCK_AFTER_SECONDS = 120;

/** Past twelve hours, a bare clock time stops telling an operator which day. */
const TODAY_SECONDS = 12 * 60 * 60;

/**
 * Runtime membership test for the RideStatus union, derived from the transition
 * table rather than written out again — the same trick the backend uses, and
 * for the same reason: a status added to the contract is recognised here
 * without a second edit.
 */
function isRideStatus(value: string): value is RideStatus {
  return Object.prototype.hasOwnProperty.call(RIDE_TRANSITIONS, value);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BoardParams {
  /** A board filter (`live`, …) or one exact ride status. */
  status?: AdminRideFilter | RideStatus;
  riderId?: string;
  driverId?: string;
  page: number;
}

/**
 * `typedRoutes` can only check route literals, and every link on this page is
 * assembled from query state at runtime. One cast here keeps the rest of the
 * file honest about which routes exist.
 */
function boardHref(params: Partial<BoardParams>): Route {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.riderId) search.set('riderId', params.riderId);
  if (params.driverId) search.set('driverId', params.driverId);
  if (params.page && params.page > 1) search.set('page', String(params.page));
  const qs = search.toString();
  return (qs ? `/rides?${qs}` : '/rides') as Route;
}

function rideHref(rideId: string): Route {
  return `/rides/${rideId}` as Route;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Anything unparseable in the URL falls back to the unfiltered first page. */
function readParams(raw: Record<string, string | string[] | undefined>): BoardParams {
  const status = first(raw.status)?.trim();
  const riderId = first(raw.riderId)?.trim();
  const driverId = first(raw.driverId)?.trim();
  const page = Number.parseInt(first(raw.page) ?? '1', 10);
  return {
    status: status && (isAdminRideFilter(status) || isRideStatus(status)) ? status : undefined,
    // Filtered here as well as upstream: a malformed id reaches Postgres as a
    // failed uuid cast, which surfaces as a 500 on a screen that should simply
    // have ignored a bad link.
    riderId: riderId && UUID_RE.test(riderId) ? riderId : undefined,
    driverId: driverId && UUID_RE.test(driverId) ? driverId : undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** The badge on a tab: every status that tab covers, summed. */
function filterCount(counts: AdminRideListPage['counts'], filter: AdminRideFilter): number {
  return ADMIN_RIDE_FILTERS[filter].reduce((sum, status) => sum + (counts[status] ?? 0), 0);
}

export default async function RidesBoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = readParams(await searchParams);
  const offset = (params.page - 1) * PAGE_SIZE;

  const query = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  if (params.status) query.set('status', params.status);
  if (params.riderId) query.set('riderId', params.riderId);
  if (params.driverId) query.set('driverId', params.driverId);

  let board: AdminRideListPage;
  try {
    board = await apiServerFetch<AdminRideListPage>(`${ADMIN_RIDES_PATH}?${query.toString()}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect('/login');
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return (
      <div className="mx-auto max-w-7xl">
        <ErrorPanel
          title="Unable to load the dispatch board"
          message={message}
          action={
            <Link
              href={boardHref(params)}
              className="inline-flex rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Try again
            </Link>
          }
        />
      </div>
    );
  }

  const total = Object.values(board.counts).reduce((sum, n) => sum + n, 0);
  const lastPage = Math.max(1, Math.ceil(board.total / PAGE_SIZE));
  const rangeStart = board.total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + board.items.length, board.total);
  const scoped = Boolean(params.riderId ?? params.driverId);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Dispatch board</h2>
          <p className="mt-1 text-sm text-text-muted">
            Rides still happening come first, longest wait at the top — that rider is the one
            closest to giving up.
          </p>
        </div>
        <AutoRefresh />
      </header>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        <TabLink
          href={boardHref({ riderId: params.riderId, driverId: params.driverId })}
          label="All"
          count={total}
          active={params.status === undefined}
        />
        {ADMIN_RIDE_FILTER_NAMES.map((filter) => (
          <TabLink
            key={filter}
            href={boardHref({
              status: filter,
              riderId: params.riderId,
              driverId: params.driverId,
            })}
            label={adminRideFilterLabel(filter)}
            count={filterCount(board.counts, filter)}
            active={params.status === filter}
            emphasis={filter === 'live'}
          />
        ))}
        {/* A deep link to one exact status (from an event trail, say) is not one
            of the tabs, so it gets a chip of its own rather than silently
            looking like "All". */}
        {params.status && !isAdminRideFilter(params.status) && (
          <TabLink
            href={boardHref(params)}
            label={rideStatusLabel(params.status)}
            count={board.counts[params.status] ?? 0}
            active
          />
        )}
      </nav>

      {scoped && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
          <span>
            Showing rides for one {params.driverId ? 'driver' : 'rider'} —{' '}
            <span className="font-mono text-xs">{params.driverId ?? params.riderId}</span>
          </span>
          <Link
            href={boardHref({ status: params.status })}
            className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Clear
          </Link>
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        {board.items.length === 0 ? (
          <EmptyState title={emptyTitle(params)} description={emptyDescription(params)} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                Rides
                {params.status
                  ? `, ${
                      isAdminRideFilter(params.status)
                        ? adminRideFilterLabel(params.status)
                        : rideStatusLabel(params.status)
                    }`
                  : ''}
                , longest-waiting live ride first
              </caption>
              <thead className="border-b border-border bg-surface-muted/60 text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Rider
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Driver
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Route
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Fare
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Age
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {board.items.map((ride) => (
                  <RideRow key={ride.id} ride={ride} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {board.items.length > 0 && (
        <nav
          aria-label="Pagination"
          className="flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <p className="text-text-muted">
            Showing {rangeStart}–{rangeEnd} of {board.total}
          </p>
          <div className="flex gap-2">
            <PagerLink
              href={boardHref({ ...params, page: params.page - 1 })}
              label="Previous"
              disabled={params.page <= 1}
            />
            <PagerLink
              href={boardHref({ ...params, page: params.page + 1 })}
              label="Next"
              disabled={params.page >= lastPage}
            />
          </div>
        </nav>
      )}
    </div>
  );
}

/**
 * One ride.
 *
 * In-flight rides are marked three ways on purpose — a tinted row, a coloured
 * left edge, and a pulsing dot — because this screen is read at a glance from a
 * distance, often by somebody who is on the phone. Colour alone would also fail
 * anyone who cannot distinguish it, which is why the dot moves and the status
 * word is spelled out beside it.
 */
function RideRow({ ride }: { ride: AdminRideListItem }) {
  const inFlight = isInFlightRideStatus(ride.status);
  const unassigned = ride.driver === null;
  const stuck = inFlight && unassigned && ride.ageSeconds >= STUCK_AFTER_SECONDS;

  return (
    <tr
      className={cn(
        'align-middle transition hover:bg-surface-muted/50',
        inFlight && 'bg-info-500/[0.04]',
      )}
    >
      <td
        className={cn(
          'px-4 py-3',
          inFlight && 'border-l-2 border-l-info-500',
          stuck && 'border-l-danger-600',
        )}
      >
        <span className="flex items-center gap-2">
          {inFlight && (
            <span
              aria-hidden="true"
              className={cn(
                'h-1.5 w-1.5 shrink-0 animate-pulse rounded-full',
                stuck ? 'bg-danger-600' : 'bg-info-500',
              )}
            />
          )}
          <RideStatusBadge status={ride.status} />
        </span>
        <span className="mt-1 block text-xs text-text-muted">
          {rideClassLabel(ride.rideClass)}
          {ride.dispatchRound > 0 ? ` · round ${ride.dispatchRound}` : ''}
        </span>
      </td>

      {/* The rider is the row header, not the status: "who is this ride for" is
          what identifies the row, and it is what a screen reader should repeat
          in front of every other cell. */}
      <th scope="row" className="px-4 py-3 font-normal">
        <Link
          href={rideHref(ride.id)}
          className="font-medium text-text underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {ride.rider.fullName ?? 'Unnamed rider'}
        </Link>
      </th>

      <td className="px-4 py-3">
        {ride.driver ? (
          <span className="text-text">{ride.driver.fullName ?? 'Unnamed driver'}</span>
        ) : (
          <span className={cn('text-text-muted', stuck && 'text-danger-700 dark:text-danger-500')}>
            {ride.pendingOfferCount > 0
              ? `${ride.pendingOfferCount} offer${ride.pendingOfferCount === 1 ? '' : 's'} out`
              : inFlight
                ? 'Nobody offered'
                : 'Unassigned'}
          </span>
        )}
      </td>

      <td className="max-w-xs px-4 py-3 text-text-muted">
        <span className="block truncate" title={ride.pickupAddress}>
          {ride.pickupAddress}
        </span>
        <span className="block truncate" title={ride.dropoffAddress}>
          <span aria-hidden="true">↓ </span>
          <span className="sr-only">to </span>
          {ride.dropoffAddress}
        </span>
      </td>

      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-text-muted">
        {formatMoneyCents(ride.fareCents, ride.currency)}
      </td>

      <td className="whitespace-nowrap px-4 py-3">
        <span
          className={cn(
            'tabular-nums',
            stuck ? 'font-medium text-danger-700 dark:text-danger-500' : 'text-text-muted',
          )}
        >
          {formatDuration(ride.ageSeconds)}
        </span>
        <span className="block text-xs text-text-muted">
          {/* A time alone is unambiguous for anything from today and misleading
              for anything older, which the finished tabs are full of. */}
          <time dateTime={ride.requestedAt}>
            {ride.ageSeconds > TODAY_SECONDS
              ? formatDateTime(ride.requestedAt)
              : formatTimeOfDay(ride.requestedAt)}
          </time>
        </span>
      </td>

      <td className="px-4 py-3 text-right">
        <Link
          href={rideHref(ride.id)}
          aria-label={`Open ride for ${ride.rider.fullName ?? 'unnamed rider'}`}
          className="inline-flex rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Open
        </Link>
      </td>
    </tr>
  );
}

function TabLink({
  href,
  label,
  count,
  active,
  emphasis,
}: {
  href: Route;
  label: string;
  count: number;
  active: boolean;
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        active
          ? 'border-primary bg-primary text-primary-text'
          : emphasis && count > 0
            ? // The live tab is the one an operator is actually watching, so it
              // keeps a tint even when another tab is selected.
              'border-info-500/40 bg-info-500/10 text-info-700 hover:bg-info-500/20 dark:text-info-500'
            : 'border-border bg-surface text-text-muted hover:bg-surface-muted hover:text-text',
      )}
    >
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums',
          active ? 'bg-primary-text/20 text-primary-text' : 'bg-surface-muted text-text-muted',
        )}
      >
        {count}
      </span>
    </Link>
  );
}

/**
 * A disabled pager is a <span>, not a disabled link: an anchor with no
 * destination is still in the tab order and still announces as a link.
 */
function PagerLink({
  href,
  label,
  disabled,
}: {
  href: Route;
  label: string;
  disabled: boolean;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-muted/50"
      >
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {label}
    </Link>
  );
}

function emptyTitle(params: BoardParams): string {
  if (params.driverId) return 'No rides for this driver';
  if (params.riderId) return 'No rides for this rider';
  if (params.status === 'live') return 'Nothing in flight';
  if (params.status) return 'Nothing in this state';
  return 'No rides yet';
}

function emptyDescription(params: BoardParams): string {
  if (params.status === 'live') {
    return 'No trip is under way right now. Rides appear here the moment a driver accepts one.';
  }
  if (params.status === 'searching') {
    return 'Nobody is waiting on a driver. This tab fills the instant a rider requests a ride.';
  }
  if (params.status === 'unmatched') {
    return 'Dispatch has not given up on anybody — which is the state this tab should stay in.';
  }
  if (params.riderId ?? params.driverId) {
    return 'Nothing matched that filter. Clear it to see the whole board.';
  }
  return 'Rides appear here as soon as riders start requesting them in the rider app.';
}
