/**
 * Status pills.
 *
 * A reviewer scans the queue by colour before they read a word of it, so the
 * mapping from status to tone is fixed here rather than chosen per screen.
 * `suspended` is the one solid fill in the set: it is the only status that
 * means "this driver must not be on the road right now", and a tinted chip
 * identical in weight to the other five loses that in a list of twenty rows.
 */
import type {
  DriverDocumentStatus,
  KycStatus,
  RideOfferStatus,
  RideStatus,
  VehicleStatus,
} from '@uride/types';
import { cn } from '@uride/ui-web';
import {
  documentStatusLabel,
  kycStatusLabel,
  offerStatusLabel,
  rideStatusLabel,
  vehicleStatusLabel,
} from './format';

export type BadgeTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'danger-solid';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'border-border bg-surface-muted text-text-muted',
  info: 'border-info-500/30 bg-info-500/10 text-info-700 dark:text-info-500',
  warning: 'border-warning-500/30 bg-warning-500/10 text-warning-700 dark:text-warning-500',
  success: 'border-success-500/30 bg-success-500/10 text-success-700 dark:text-success-500',
  danger: 'border-danger-500/30 bg-danger-500/10 text-danger-700 dark:text-danger-500',
  'danger-solid': 'border-danger-600 bg-danger-600 text-white',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const KYC_TONES: Record<KycStatus, BadgeTone> = {
  not_started: 'neutral',
  documents_pending: 'warning',
  under_review: 'info',
  approved: 'success',
  rejected: 'danger',
  suspended: 'danger-solid',
};

export function KycStatusBadge({ status }: { status: KycStatus }) {
  return <Badge tone={KYC_TONES[status]}>{kycStatusLabel(status)}</Badge>;
}

const REVIEW_TONES: Record<DriverDocumentStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

export function DocumentStatusBadge({ status }: { status: DriverDocumentStatus }) {
  return <Badge tone={REVIEW_TONES[status]}>{documentStatusLabel(status)}</Badge>;
}

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  return <Badge tone={REVIEW_TONES[status]}>{vehicleStatusLabel(status)}</Badge>;
}

/**
 * Ride statuses on the live board.
 *
 * The tones say what an operator has to do, not what the state machine calls
 * it. Warning is "somebody is waiting and nothing has happened yet"; info is
 * "matched, in motion, nothing to do"; success is only for a trip that is
 * actually running or has finished paying its way. `no_drivers_found` takes the
 * one solid fill in the set — the same role `suspended` plays on the KYC queue —
 * because it is the only status that means the platform failed a rider outright,
 * and a tinted chip identical in weight to the other thirteen loses that in a
 * list of forty rows.
 */
const RIDE_TONES: Record<RideStatus, BadgeTone> = {
  requested: 'warning',
  searching: 'warning',
  accepted: 'info',
  driver_arriving: 'info',
  arrived: 'info',
  in_progress: 'success',
  completed: 'success',
  payment_pending: 'warning',
  payment_failed: 'danger',
  rated_pending: 'neutral',
  closed: 'neutral',
  cancelled_by_rider: 'danger',
  cancelled_by_driver: 'danger',
  no_drivers_found: 'danger-solid',
};

export function RideStatusBadge({ status }: { status: RideStatus }) {
  return <Badge tone={RIDE_TONES[status]}>{rideStatusLabel(status)}</Badge>;
}

/**
 * Offer outcomes.
 *
 * `expired` and `declined` are deliberately different colours even though both
 * freed the driver: a driver who lets offers time out and one who answers no
 * are very different signals, and the offer table exists to tell them apart.
 */
const OFFER_TONES: Record<RideOfferStatus, BadgeTone> = {
  pending: 'info',
  accepted: 'success',
  declined: 'warning',
  expired: 'danger',
  revoked: 'neutral',
};

export function OfferStatusBadge({ status }: { status: RideOfferStatus }) {
  return <Badge tone={OFFER_TONES[status]}>{offerStatusLabel(status)}</Badge>;
}
