import type {
  AdminRideDetail,
  AdminRideListPage,
  FareQuote,
  RideSummary,
} from '@uride/types';
import type {
  AdminRideListQueryInput,
  QuoteRequestInput,
  RideCancelInput,
  RideReassignInput,
  RideRequestInput,
} from '@uride/validation';
import type { AuthClient } from './auth';

/**
 * RidesClient — booking endpoints, layered on AuthClient so every call gets
 * automatic refresh-on-401. Construct once with the app's AuthClient.
 */
export class RidesClient {
  constructor(private readonly auth: AuthClient) {}

  /** Fare estimate — no ride created. */
  async quote(input: QuoteRequestInput): Promise<FareQuote> {
    return this.auth.withAutoRefresh(() =>
      this.auth.rawClient.request<FareQuote>('/v1/rides/quote', {
        method: 'POST',
        body: input,
      }),
    );
  }

  /** Request a ride. `input.idempotencyKey` makes retries safe. */
  async create(input: RideRequestInput): Promise<RideSummary> {
    return this.auth.withAutoRefresh(() =>
      this.auth.rawClient.request<RideSummary>('/v1/rides', {
        method: 'POST',
        body: input,
        idempotencyKey: input.idempotencyKey,
      }),
    );
  }

  async get(id: string): Promise<RideSummary> {
    return this.auth.withAutoRefresh(() =>
      this.auth.rawClient.request<RideSummary>(`/v1/rides/${id}`),
    );
  }

  async listMine(): Promise<RideSummary[]> {
    return this.auth.withAutoRefresh(() =>
      this.auth.rawClient.request<RideSummary[]>('/v1/rides'),
    );
  }

  async cancel(id: string, input: RideCancelInput): Promise<RideSummary> {
    return this.auth.withAutoRefresh(() =>
      this.auth.rawClient.request<RideSummary>(`/v1/rides/${id}/cancel`, {
        method: 'POST',
        body: input,
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Ops / dispatch desk
// ---------------------------------------------------------------------------

/** Root of the live dispatch surface on the core API. */
export const ADMIN_RIDES_PATH = '/v1/admin/rides';

/**
 * Path builders are exported alongside the client for the same reason the KYC
 * ones are: the dashboard talks to these endpoints from three places — Server
 * Components, its own proxy route handler, and this client — and a hand-built
 * URL in any one of them is a 404 nobody notices until an operator hits it
 * mid-incident.
 */
export function adminRideDetailPath(rideId: string): string {
  return `${ADMIN_RIDES_PATH}/${rideId}`;
}

/** Server defaults fill in whatever the caller leaves out — see adminRideListQuerySchema. */
export type AdminRideListQuery = Partial<AdminRideListQueryInput>;

/**
 * AdminRidesClient — the ops-side dispatch endpoints, layered on AuthClient so
 * every call inherits refresh-on-401 exactly like RidesClient above.
 *
 * Both interventions resolve to the full {@link AdminRideDetail} the API
 * returns rather than a bare 204, so a caller can re-render the ride — its new
 * status, its now-empty offer list, the event the intervention appended — from
 * the response instead of firing a second read that races the first.
 */
export class AdminRidesClient {
  constructor(private readonly auth: AuthClient) {}

  /**
   * One page of the board. `status` takes an exact ride status or one of the
   * board filters (`live`, `searching`, `unmatched`, `finished`, `cancelled`).
   */
  async list(query: AdminRideListQuery = {}): Promise<AdminRideListPage> {
    return this.auth.withAutoRefresh(() =>
      this.auth.rawClient.request<AdminRideListPage>(ADMIN_RIDES_PATH, {
        query: { ...query },
      }),
    );
  }

  /** One ride in full: parties, every offer, and the event trail. */
  async detail(rideId: string): Promise<AdminRideDetail> {
    return this.auth.withAutoRefresh(() =>
      this.auth.rawClient.request<AdminRideDetail>(adminRideDetailPath(rideId)),
    );
  }

  /** Hand the ride to another driver. Admin only; the API refuses anyone else. */
  async reassign(rideId: string, input: RideReassignInput): Promise<AdminRideDetail> {
    return this.auth.withAutoRefresh(() =>
      this.auth.rawClient.request<AdminRideDetail>(`${adminRideDetailPath(rideId)}/reassign`, {
        method: 'POST',
        body: input,
      }),
    );
  }

  /** End a ride on the platform's behalf. Admin and ops. */
  async cancel(rideId: string, input: RideCancelInput): Promise<AdminRideDetail> {
    return this.auth.withAutoRefresh(() =>
      this.auth.rawClient.request<AdminRideDetail>(`${adminRideDetailPath(rideId)}/cancel`, {
        method: 'POST',
        body: input,
      }),
    );
  }
}
