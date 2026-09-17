/**
 * The KYC review queue.
 *
 * Server Component: the list and the badge counts are fetched with the bearer
 * token from the httpOnly cookie and rendered to HTML, so no driver's name,
 * phone or application state ever passes through a client-side store.
 *
 * All queue state lives in the URL — tab, search, page. A reviewer working
 * through "Under review" can send a colleague a link to exactly what they are
 * looking at, and the browser's Back button behaves the way they expect.
 */
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ADMIN_DRIVERS_PATH, ApiError } from '@uride/api-client';
import { kycStatusSchema } from '@uride/validation';
import {
  REQUIRED_DRIVER_DOCUMENTS,
  type AdminDriverCounts,
  type AdminDriverListItem,
  type AdminDriverListPage,
  type KycStatus,
} from '@uride/types';
import { cn } from '@uride/ui-web';
import { apiServerFetch } from '@/lib/api-server';
import { EmptyState } from '@/components/empty-state';
import { ErrorPanel } from '@/components/error-panel';
import { KycStatusBadge } from '@/components/status-badge';
import { formatDateTime, formatPhone, kycStatusLabel } from '@/components/format';

export const metadata: Metadata = {
  title: 'Drivers · WeRide Admin',
};

const PAGE_SIZE = 25;

/**
 * Tab order is the reviewer's working order, not the enum's: the two states
 * that represent unfinished work sit first, and the archives of finished
 * decisions come after them.
 */
const TABS: readonly KycStatus[] = [
  'under_review',
  'documents_pending',
  'not_started',
  'approved',
  'rejected',
  'suspended',
];

interface QueueParams {
  status?: KycStatus;
  q?: string;
  page: number;
}

/**
 * `typedRoutes` can only check route literals, and every link on this page is
 * assembled from query state at runtime. One cast here keeps the rest of the
 * file honest about which routes exist.
 */
function queueHref(params: { status?: KycStatus; q?: string; page?: number }): Route {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.q) search.set('q', params.q);
  if (params.page && params.page > 1) search.set('page', String(params.page));
  const qs = search.toString();
  return (qs ? `/drivers?${qs}` : '/drivers') as Route;
}

function driverHref(driverId: string): Route {
  return `/drivers/${driverId}` as Route;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Anything unparseable in the URL falls back to the unfiltered first page. */
function readParams(raw: Record<string, string | string[] | undefined>): QueueParams {
  const status = kycStatusSchema.safeParse(first(raw.status));
  const q = first(raw.q)?.trim().slice(0, 128);
  const page = Number.parseInt(first(raw.page) ?? '1', 10);
  return {
    status: status.success ? status.data : undefined,
    q: q ? q : undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export default async function DriversQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = readParams(await searchParams);
  const offset = (params.page - 1) * PAGE_SIZE;

  const listQuery = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  if (params.status) listQuery.set('status', params.status);
  if (params.q) listQuery.set('q', params.q);

  let page: AdminDriverListPage;
  let counts: AdminDriverCounts;
  try {
    // In parallel: the badges are as much a part of the first paint as the rows,
    // and serialising them would add a round trip to every tab switch.
    [page, counts] = await Promise.all([
      apiServerFetch<AdminDriverListPage>(`${ADMIN_DRIVERS_PATH}?${listQuery.toString()}`),
      apiServerFetch<AdminDriverCounts>(`${ADMIN_DRIVERS_PATH}/counts`),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect('/login');
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return (
      <div className="mx-auto max-w-6xl">
        <ErrorPanel
          title="Unable to load the review queue"
          message={message}
          action={
            <Link
              href={queueHref({ status: params.status, q: params.q })}
              className="inline-flex rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Try again
            </Link>
          }
        />
      </div>
    );
  }

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const lastPage = Math.max(1, Math.ceil(page.total / PAGE_SIZE));
  const rangeStart = page.total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + page.items.length, page.total);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">KYC review queue</h2>
          <p className="mt-1 text-sm text-text-muted">
            Oldest application first — the applicant waiting longest is the one losing income.
          </p>
        </div>
        <SearchForm status={params.status} q={params.q} />
      </header>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        <TabLink
          href={queueHref({ q: params.q })}
          label="All"
          count={total}
          active={params.status === undefined}
        />
        {TABS.map((status) => (
          <TabLink
            key={status}
            href={queueHref({ status, q: params.q })}
            label={kycStatusLabel(status)}
            count={counts[status]}
            active={params.status === status}
          />
        ))}
      </nav>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        {page.items.length === 0 ? (
          <EmptyState
            title={emptyTitle(params)}
            description={emptyDescription(params)}
            action={
              params.q ? (
                <Link
                  href={queueHref({ status: params.status })}
                  className="inline-flex rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Clear search
                </Link>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                Driver applications{params.status ? `, ${kycStatusLabel(params.status)}` : ''}
              </caption>
              <thead className="border-b border-border bg-surface-muted/60 text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Driver
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Phone
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Vehicle
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Documents
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Submitted
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    <span className="sr-only">Review</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {page.items.map((item) => (
                  <QueueRow key={item.userId} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {page.items.length > 0 && (
        <nav
          aria-label="Pagination"
          className="flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <p className="text-text-muted">
            Showing {rangeStart}–{rangeEnd} of {page.total}
          </p>
          <div className="flex gap-2">
            <PagerLink
              href={queueHref({ ...params, page: params.page - 1 })}
              label="Previous"
              disabled={params.page <= 1}
            />
            <PagerLink
              href={queueHref({ ...params, page: params.page + 1 })}
              label="Next"
              disabled={params.page >= lastPage}
            />
          </div>
        </nav>
      )}
    </div>
  );
}

function QueueRow({ item }: { item: AdminDriverListItem }) {
  const required = REQUIRED_DRIVER_DOCUMENTS.length;
  const uploaded = Math.min(item.documentCount, required);

  return (
    <tr className="align-middle transition hover:bg-surface-muted/50">
      <th scope="row" className="px-4 py-3 font-normal">
        <Link
          href={driverHref(item.userId)}
          className="font-medium text-text underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {item.fullName ?? 'Unnamed driver'}
        </Link>
        <span className="block text-xs text-text-muted">{item.email ?? 'No email'}</span>
      </th>
      <td className="whitespace-nowrap px-4 py-3 text-text-muted">{formatPhone(item.phone)}</td>
      <td className="px-4 py-3 text-text-muted">{item.vehicleSummary ?? 'No vehicle'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted"
          >
            <span
              className={cn(
                'block h-full rounded-full',
                uploaded === required ? 'bg-success-600' : 'bg-primary',
              )}
              style={{ width: `${(uploaded / required) * 100}%` }}
            />
          </span>
          <span className="text-xs text-text-muted">
            {uploaded}/{required} uploaded
            {item.pendingDocumentCount > 0 ? ` · ${item.pendingDocumentCount} to review` : ''}
          </span>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-text-muted">
        {item.submittedAt ? (
          <time dateTime={item.submittedAt}>{formatDateTime(item.submittedAt)}</time>
        ) : (
          'Not submitted'
        )}
      </td>
      <td className="px-4 py-3">
        <KycStatusBadge status={item.kycStatus} />
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={driverHref(item.userId)}
          aria-label={`Review ${item.fullName ?? 'driver'}`}
          className="inline-flex rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Review
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
}: {
  href: Route;
  label: string;
  count: number;
  active: boolean;
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
          : 'border-border bg-surface text-text-muted hover:bg-surface-muted hover:text-text',
      )}
    >
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 py-0.5 text-xs font-medium',
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

/**
 * A plain GET form, so search works before any JavaScript loads and the result
 * is a URL the reviewer can bookmark. Submitting drops `page` on purpose —
 * page 4 of the previous search is never the right landing spot for a new one.
 */
function SearchForm({ status, q }: { status?: KycStatus; q?: string }) {
  return (
    <form method="get" action="/drivers" className="flex items-end gap-2" role="search">
      {status && <input type="hidden" name="status" value={status} />}
      <div className="space-y-1">
        <label htmlFor="driver-search" className="block text-xs font-medium text-text-muted">
          Search
        </label>
        <input
          id="driver-search"
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Name, phone or email"
          maxLength={128}
          className="w-64 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text shadow-sm placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <button
        type="submit"
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-text shadow-sm transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        Search
      </button>
    </form>
  );
}

function emptyTitle(params: QueueParams): string {
  if (params.q) return `No drivers match “${params.q}”`;
  if (params.status) return `Nothing in ${kycStatusLabel(params.status).toLowerCase()}`;
  return 'No driver applications yet';
}

function emptyDescription(params: QueueParams): string {
  if (params.q) return 'Search matches name, phone and email. Try a shorter term.';
  if (params.status === 'under_review' || params.status === 'documents_pending') {
    return 'The queue is clear — every application in this state has been dealt with.';
  }
  if (params.status) return 'No driver is in this state right now.';
  return 'Applications appear here as soon as a driver starts onboarding in the driver app.';
}
