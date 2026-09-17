/**
 * Presentation formatters for the ops console.
 *
 * Wire values are deliberately raw — ISO timestamps, snake_case enums, byte
 * counts — so every surface renders them the same way only if the mapping
 * lives in one place. Labels are Canadian English ("licence"), matching the
 * language the backend and the driver app already use.
 */
import type {
  AdminRideFilter,
  Currency,
  DriverDocumentStatus,
  DriverDocumentType,
  KycStatus,
  RideClass,
  RideEventActor,
  RideOfferDeclineReason,
  RideOfferStatus,
  RideStatus,
  Vehicle,
  VehicleStatus,
} from '@uride/types';

const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  not_started: 'Not started',
  documents_pending: 'Documents pending',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

export function kycStatusLabel(status: KycStatus): string {
  return KYC_STATUS_LABELS[status];
}

const DOCUMENT_TYPE_LABELS: Record<DriverDocumentType, string> = {
  drivers_license_front: 'Licence — front',
  drivers_license_back: 'Licence — back',
  vehicle_registration: 'Vehicle registration',
  insurance: 'Insurance',
  profile_photo: 'Profile photo',
  background_check: 'Background check',
};

export function documentTypeLabel(type: DriverDocumentType): string {
  return DOCUMENT_TYPE_LABELS[type];
}

const DOCUMENT_STATUS_LABELS: Record<DriverDocumentStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function documentStatusLabel(status: DriverDocumentStatus): string {
  return DOCUMENT_STATUS_LABELS[status];
}

const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function vehicleStatusLabel(status: VehicleStatus): string {
  return VEHICLE_STATUS_LABELS[status];
}

const RIDE_CLASS_LABELS: Record<RideClass, string> = {
  standard: 'Standard',
  xl: 'XL',
  premium: 'Premium',
};

export function rideClassLabel(rideClass: RideClass): string {
  return RIDE_CLASS_LABELS[rideClass];
}

/** `2026 Toyota Corolla · BXTZ429` — the same shape the queue's vehicleSummary uses. */
export function vehicleSummary(vehicle: Vehicle): string {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.plate}`;
}

/**
 * Fixed to en-CA rather than the reviewer's locale: these timestamps get
 * quoted verbatim into support tickets and compliance requests, and two
 * reviewers reading the same application must read the same date.
 */
const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-CA', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const DATE_FORMAT = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium' });

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return DATE_TIME_FORMAT.format(parsed);
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return DATE_FORMAT.format(parsed);
}

/** True once the date is in the past — an expired licence blocks approval. */
export function isExpired(iso: string | null): boolean {
  if (!iso) return false;
  const parsed = Date.parse(iso);
  return !Number.isNaN(parsed) && parsed < Date.now();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** +15195550142 -> +1 519 555 0142. Left untouched if it is not E.164-shaped. */
export function formatPhone(phone: string | null): string {
  if (!phone) return '—';
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phone);
  return match ? `+1 ${match[1]} ${match[2]} ${match[3]}` : phone;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Ride statuses, phrased for an operator rather than for the state machine.
 *
 * `no_drivers_found` gets the bluntest wording in the set on purpose: it is the
 * only status that means a rider asked for a car and the platform failed to
 * produce one, and "No driver found" is what makes that scannable in a column
 * of otherwise reassuring words.
 */
const RIDE_STATUS_LABELS: Record<RideStatus, string> = {
  requested: 'Requested',
  searching: 'Searching',
  accepted: 'Accepted',
  driver_arriving: 'Driver en route',
  arrived: 'At pickup',
  in_progress: 'On trip',
  completed: 'Completed',
  payment_pending: 'Payment pending',
  payment_failed: 'Payment failed',
  rated_pending: 'Awaiting rating',
  closed: 'Closed',
  cancelled_by_rider: 'Cancelled — rider',
  cancelled_by_driver: 'Cancelled — driver',
  no_drivers_found: 'No driver found',
};

export function rideStatusLabel(status: RideStatus): string {
  return RIDE_STATUS_LABELS[status];
}

/** Tab labels for the board. The filter names themselves stay in @uride/types. */
const RIDE_FILTER_LABELS: Record<AdminRideFilter, string> = {
  live: 'In flight',
  searching: 'Finding a driver',
  unmatched: 'No driver found',
  finished: 'Finished',
  cancelled: 'Cancelled',
};

export function adminRideFilterLabel(filter: AdminRideFilter): string {
  return RIDE_FILTER_LABELS[filter];
}

const OFFER_STATUS_LABELS: Record<RideOfferStatus, string> = {
  pending: 'Waiting',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Timed out',
  revoked: 'Withdrawn',
};

export function offerStatusLabel(status: RideOfferStatus): string {
  return OFFER_STATUS_LABELS[status];
}

const OFFER_DECLINE_LABELS: Record<RideOfferDeclineReason, string> = {
  too_far: 'Too far',
  wrong_direction: 'Wrong direction',
  taking_a_break: 'Taking a break',
  vehicle_issue: 'Vehicle issue',
  other: 'Other',
};

export function offerDeclineReasonLabel(reason: RideOfferDeclineReason | null): string {
  return reason ? OFFER_DECLINE_LABELS[reason] : '—';
}

const EVENT_ACTOR_LABELS: Record<RideEventActor, string> = {
  rider: 'Rider',
  driver: 'Driver',
  system: 'Dispatch',
  admin: 'Ops',
};

export function eventActorLabel(actor: RideEventActor): string {
  return EVENT_ACTOR_LABELS[actor];
}

/**
 * `offer.accepted` -> `Offer accepted`.
 *
 * Derived rather than enumerated: event types are free-form strings the backend
 * may add to at any time, and a lookup table would render a brand-new event as
 * a blank cell on the one screen somebody is using to work out what it means.
 */
export function rideEventLabel(type: string): string {
  const words = type.replace(/[._]/g, ' ').trim();
  if (!words) return type;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Integer cents -> `$42.75`.
 *
 * Currency comes off the ride rather than being assumed: the platform is
 * CAD-only today, and hard-coding that here is how a second market ships a
 * console that quietly relabels every fare.
 */
export function formatMoneyCents(cents: number | null, currency: Currency): string {
  if (cents === null) return '—';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(cents / 100);
}

/** 340 -> `340 m`; 4230 -> `4.2 km`. */
export function formatDistanceMeters(meters: number | null): string {
  if (meters === null) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Seconds -> `48s`, `4m 12s`, `1h 07m`.
 *
 * Seconds are kept below the ten-minute mark because that is the range where
 * dispatch is judged — the difference between a 40-second and a 90-second wait
 * for a driver to answer is the difference between a working loop and a broken
 * one — and dropped above it, where they are noise.
 */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) {
    return minutes < 10 ? `${minutes}m ${String(total % 60).padStart(2, '0')}s` : `${minutes}m`;
  }
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/**
 * Timestamps for the event trail, to the second.
 *
 * `formatDateTime` above stops at minutes, which is the right resolution for a
 * KYC application and useless for dispatch: a whole offer wave — created,
 * declined, re-offered — can happen inside one minute, and a trail that renders
 * those three events with identical timestamps hides the thing it exists to show.
 */
const TIME_SECONDS_FORMAT = new Intl.DateTimeFormat('en-CA', { timeStyle: 'medium' });

export function formatTimeOfDay(iso: string | null): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return TIME_SECONDS_FORMAT.format(parsed);
}

/** Seconds between two ISO timestamps, or null if either is missing/unparseable. */
export function secondsBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return (end - start) / 1000;
}
