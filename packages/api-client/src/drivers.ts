import type {
  AdminDriverCounts,
  AdminDriverDetail,
  AdminDriverListPage,
} from '@uride/types';
import type {
  AdminDriverListQueryInput,
  ApprovalInput,
  DocumentReviewInput,
  RejectionInput,
  SuspensionInput,
} from '@uride/validation';
import type { AuthClient } from './auth';

/** Root of the KYC review surface on the core API. */
export const ADMIN_DRIVERS_PATH = '/v1/admin/drivers';

/**
 * Path builders are exported alongside the client because the dashboard talks
 * to these endpoints from three places — Server Components, its own proxy route
 * handler, and this client — and a hand-built URL in any one of them is a 404
 * nobody notices until a reviewer hits it.
 */
export function adminDriverDetailPath(driverId: string): string {
  return `${ADMIN_DRIVERS_PATH}/${driverId}`;
}

export function adminDriverDocumentFilePath(driverId: string, documentId: string): string {
  return `${ADMIN_DRIVERS_PATH}/${driverId}/documents/${documentId}/file`;
}

/** Server defaults fill in whatever the caller leaves out — see adminDriverListQuerySchema. */
export type AdminDriverListQuery = Partial<AdminDriverListQueryInput>;

/**
 * AdminDriversClient — the ops-side KYC endpoints, layered on AuthClient so
 * every call inherits refresh-on-401 exactly like RidesClient.
 *
 * Every decision method resolves to the full {@link AdminDriverDetail} the API
 * returns rather than a bare 204, so a caller can re-render the review screen
 * from the response instead of firing a second read that races the first.
 *
 * Documents are deliberately absent: the bytes are government ID scans, and a
 * browser fetching them needs a bearer token in reach of page JavaScript. The
 * dashboard streams them through its own server instead — see
 * {@link adminDriverDocumentFilePath} for the upstream path it proxies to.
 */
export class AdminDriversClient {
  constructor(private readonly auth: AuthClient) {}

  /** One page of the queue. Oldest application first unless `q` is set. */
  async list(query: AdminDriverListQuery = {}): Promise<AdminDriverListPage> {
    return this.auth.withAutoRefresh(() =>
      this.auth.rawClient.request<AdminDriverListPage>(ADMIN_DRIVERS_PATH, {
        query: { ...query },
      }),
    );
  }

  /** Per-status totals for the queue tab badges. */
  async counts(): Promise<AdminDriverCounts> {
    return this.auth.withAutoRefresh(() =>
      this.auth.rawClient.request<AdminDriverCounts>(`${ADMIN_DRIVERS_PATH}/counts`),
    );
  }

  async detail(driverId: string): Promise<AdminDriverDetail> {
    return this.auth.withAutoRefresh(() =>
      this.auth.rawClient.request<AdminDriverDetail>(adminDriverDetailPath(driverId)),
    );
  }

  async approve(driverId: string, input: ApprovalInput = {}): Promise<AdminDriverDetail> {
    return this.post(driverId, 'approve', input);
  }

  /** `reason` is shown to the driver verbatim, so the API refuses an empty one. */
  async reject(driverId: string, input: RejectionInput): Promise<AdminDriverDetail> {
    return this.post(driverId, 'reject', input);
  }

  async suspend(driverId: string, input: SuspensionInput): Promise<AdminDriverDetail> {
    return this.post(driverId, 'suspend', input);
  }

  async reinstate(driverId: string, input: ApprovalInput = {}): Promise<AdminDriverDetail> {
    return this.post(driverId, 'reinstate', input);
  }

  /** Approve or reject one document. Never approves the driver on its own. */
  async reviewDocument(
    driverId: string,
    documentId: string,
    input: DocumentReviewInput,
  ): Promise<AdminDriverDetail> {
    return this.auth.withAutoRefresh(() =>
      this.auth.rawClient.request<AdminDriverDetail>(
        `${adminDriverDetailPath(driverId)}/documents/${documentId}/review`,
        { method: 'POST', body: input },
      ),
    );
  }

  private async post(
    driverId: string,
    action: 'approve' | 'reject' | 'suspend' | 'reinstate',
    body: unknown,
  ): Promise<AdminDriverDetail> {
    return this.auth.withAutoRefresh(() =>
      this.auth.rawClient.request<AdminDriverDetail>(
        `${adminDriverDetailPath(driverId)}/${action}`,
        { method: 'POST', body },
      ),
    );
  }
}
