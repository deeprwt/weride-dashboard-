/**
 * The KYC review screen — one application, in full.
 *
 * Server Component. Every field, including the document previews' URLs, is
 * resolved here with the cookie-bound session; the two Client Components below
 * receive ids and statuses only, never tokens and never personal data they do
 * not already render.
 *
 * The readiness checklist is advisory. It reproduces the API's approval rules
 * so a reviewer can see what is outstanding before they click, but the gate
 * that decides is the one in AdminDriversService — if the two ever disagree,
 * the server wins and says why.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ADMIN_DRIVERS_PATH, ApiError } from '@uride/api-client';
import {
  REQUIRED_DRIVER_DOCUMENTS,
  type AdminDriverDetail,
  type DriverDocument,
} from '@uride/types';
import { cn } from '@uride/ui-web';
import { apiServerFetch } from '@/lib/api-server';
import { DocumentPreview } from '@/components/document-preview';
import { EmptyState } from '@/components/empty-state';
import { ErrorPanel } from '@/components/error-panel';
import {
  Badge,
  DocumentStatusBadge,
  KycStatusBadge,
  VehicleStatusBadge,
} from '@/components/status-badge';
import {
  documentTypeLabel,
  formatDate,
  formatDateTime,
  formatFileSize,
  formatPhone,
  isExpired,
  rideClassLabel,
  vehicleSummary,
} from '@/components/format';
import { DocumentReviewControls, DriverDecisionPanel } from './review-actions';

export const metadata: Metadata = {
  title: 'Driver review · WeRide Admin',
};

export default async function DriverReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let driver: AdminDriverDetail;
  try {
    driver = await apiServerFetch<AdminDriverDetail>(`${ADMIN_DRIVERS_PATH}/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect('/login');
    }
    const notFound = err instanceof ApiError && err.status === 404;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return (
      <div className="mx-auto max-w-5xl">
        <ErrorPanel
          title={notFound ? 'No such driver' : 'Unable to load this application'}
          message={notFound ? 'This application no longer exists, or the link is wrong.' : message}
          action={<BackLink />}
        />
      </div>
    );
  }

  const { profile, vehicle, documents, availability } = driver;
  const outstanding = outstandingForApproval(driver);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <BackLink />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight">
              {driver.fullName ?? 'Unnamed driver'}
            </h2>
            <KycStatusBadge status={profile.kycStatus} />
            <Badge tone={availability.isOnline ? 'success' : 'neutral'}>
              {availability.status === 'on_trip'
                ? 'On a trip'
                : availability.isOnline
                  ? 'Online'
                  : 'Offline'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {formatPhone(driver.phone)} · {driver.email ?? 'No email'} · {driver.locale}
          </p>
          <p className="mt-1 font-mono text-xs text-text-muted">{profile.userId}</p>
        </div>
      </header>

      {profile.rejectionReason && profile.kycStatus === 'rejected' && (
        <Callout title="Rejected" body={profile.rejectionReason} />
      )}
      {profile.suspensionReason && profile.kycStatus === 'suspended' && (
        <Callout
          title={`Suspended ${formatDateTime(profile.suspendedAt)}`}
          body={profile.suspensionReason}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section
            aria-labelledby="profile-heading"
            className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
          >
            <h3 id="profile-heading" className="text-base font-semibold">
              Driver
            </h3>
            <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <Detail label="Licence number" value={profile.licenceNumber ?? '—'} mono />
              <Detail label="Licence province" value={profile.licenceProvince ?? '—'} />
              <Detail
                label="Licence expires"
                value={formatDate(profile.licenceExpiresAt)}
                tone={isExpired(profile.licenceExpiresAt) ? 'danger' : undefined}
              />
              <Detail
                label="Rating"
                value={
                  profile.ratingAvg === null
                    ? 'No ratings yet'
                    : `${profile.ratingAvg.toFixed(2)} · ${profile.ratingCount} ratings`
                }
              />
              <Detail label="Rides completed" value={String(profile.totalRides)} />
              <Detail label="Applied" value={formatDateTime(profile.appliedAt)} />
              <Detail label="Submitted for review" value={formatDateTime(profile.submittedAt)} />
              <Detail label="Approved" value={formatDateTime(profile.approvedAt)} />
              <Detail label="Last ping" value={formatDateTime(availability.lastPingAt)} />
            </dl>
          </section>

          <section
            aria-labelledby="vehicle-heading"
            className="rounded-2xl border border-border bg-surface shadow-sm"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border p-6 pb-4">
              <h3 id="vehicle-heading" className="text-base font-semibold">
                Vehicle
              </h3>
              {vehicle && <VehicleStatusBadge status={vehicle.status} />}
            </div>
            {vehicle ? (
              <div className="p-6 pt-4">
                <p className="text-sm font-medium">{vehicleSummary(vehicle)}</p>
                <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  <Detail label="Colour" value={vehicle.color} />
                  <Detail label="Province" value={vehicle.province} />
                  <Detail label="Service class" value={rideClassLabel(vehicle.rideClass)} />
                  <Detail label="Passenger seats" value={String(vehicle.seats)} />
                  <Detail label="Added" value={formatDateTime(vehicle.createdAt)} />
                  <Detail label="Active vehicle" value={vehicle.isActive ? 'Yes' : 'No'} />
                </dl>
                {vehicle.rejectionReason && (
                  <div className="mt-4">
                    <Callout title="Vehicle rejected" body={vehicle.rejectionReason} />
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                title="No vehicle on file"
                description="The driver has not added a vehicle yet — approval is blocked until they do."
              />
            )}
          </section>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <DriverDecisionPanel driverId={profile.userId} status={profile.kycStatus} />
          <ReadinessChecklist outstanding={outstanding} />
        </div>
      </div>

      <section aria-labelledby="documents-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="documents-heading" className="text-base font-semibold">
            Documents
          </h3>
          <p className="text-sm text-text-muted">
            {documents.length} uploaded · {REQUIRED_DRIVER_DOCUMENTS.length} required
          </p>
        </div>

        {documents.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface shadow-sm">
            <EmptyState
              title="Nothing uploaded yet"
              description="Documents appear here as the driver uploads them from the driver app."
            />
          </div>
        ) : (
          <ul className="space-y-4">
            {documents.map((doc) => (
              <li key={doc.id}>
                <DocumentCard driverId={profile.userId} document={doc} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DocumentCard({
  driverId,
  document: doc,
}: {
  driverId: string;
  document: DriverDocument;
}) {
  const label = documentTypeLabel(doc.type);
  const expired = isExpired(doc.expiresAt);

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold">{label}</h4>
          <p className="mt-1 truncate text-xs text-text-muted">
            {doc.fileName} · {formatFileSize(doc.sizeBytes)} · uploaded{' '}
            <time dateTime={doc.uploadedAt}>{formatDateTime(doc.uploadedAt)}</time>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {doc.expiresAt && (
            <Badge tone={expired ? 'danger' : 'neutral'}>
              {expired ? 'Expired' : 'Expires'} {formatDate(doc.expiresAt)}
            </Badge>
          )}
          <DocumentStatusBadge status={doc.status} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DocumentPreview document={doc} />
        <div className="space-y-3">
          {doc.reviewedAt && (
            <p className="text-xs text-text-muted">
              Reviewed <time dateTime={doc.reviewedAt}>{formatDateTime(doc.reviewedAt)}</time>
            </p>
          )}
          {doc.rejectionReason && (
            <Callout title="Rejection reason" body={doc.rejectionReason} />
          )}
          <DocumentReviewControls
            driverId={driverId}
            documentId={doc.id}
            documentLabel={label}
            status={doc.status}
          />
        </div>
      </div>
    </article>
  );
}

function ReadinessChecklist({ outstanding }: { outstanding: string[] }) {
  return (
    <section
      aria-labelledby="checklist-heading"
      className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <h3 id="checklist-heading" className="text-base font-semibold">
        Before approval
      </h3>
      {outstanding.length === 0 ? (
        <p className="mt-2 text-sm text-success-700 dark:text-success-500">
          Everything checks out — this application is ready to approve.
        </p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-text-muted">
          {outstanding.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Detail({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'danger';
}) {
  return (
    <div>
      <dt className="text-text-muted">{label}</dt>
      <dd
        className={cn(
          'mt-1 font-medium',
          mono && 'font-mono text-xs',
          tone === 'danger' && 'text-danger-700 dark:text-danger-500',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Callout({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-danger-500/40 bg-danger-500/5 px-4 py-3">
      <p className="text-sm font-medium text-text">{title}</p>
      <p className="mt-1 text-sm text-text-muted">{body}</p>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/drivers"
      className="inline-flex items-center gap-1 text-sm text-text-muted underline-offset-2 transition hover:text-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span aria-hidden="true">←</span> Back to the queue
    </Link>
  );
}

/** Mirrors AdminDriversService.outstandingApprovalItems — see the note at the top. */
function outstandingForApproval(driver: AdminDriverDetail): string[] {
  const approved = new Set(
    driver.documents.filter((doc) => doc.status === 'approved').map((doc) => doc.type),
  );
  const items = REQUIRED_DRIVER_DOCUMENTS.filter((type) => !approved.has(type)).map(
    (type) => `${documentTypeLabel(type)} is not approved`,
  );

  if (!driver.vehicle) items.push('No vehicle on file');
  else if (driver.vehicle.status !== 'approved') items.push('Vehicle is not approved');

  if (!driver.profile.licenceNumber) items.push('No licence number on file');
  if (isExpired(driver.profile.licenceExpiresAt)) items.push('Licence on file has expired');

  return items;
}
