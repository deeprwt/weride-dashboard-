import { ApiClient, type ClientConfig } from './client';
import type { Session, SessionStore } from './session-store';
import { ApiError } from './errors';

export interface VerifyOtpResponse {
  tokens: {
    accessToken: string;
    accessExpiresAt: string;
    refreshToken: string;
    refreshExpiresAt: string;
  };
  user: Session['user'];
}

export interface RefreshResponse {
  tokens: VerifyOtpResponse['tokens'];
}

export type Gender = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';

export interface EmergencyContact {
  name: string;
  /** E.164. */
  phone: string;
}

export interface MeResponse {
  id: string;
  phone: string | null;
  email: string | null;
  fullName: string | null;
  locale: 'en-CA' | 'fr-CA';
  roles: string[];
  gender: Gender | null;
  /** YYYY-MM-DD — a calendar date, never an instant. */
  dateOfBirth: string | null;
  emergencyContact: EmergencyContact | null;
  createdAt: string;
  lastLoginAt: string | null;
}

/** Fields PATCH /v1/me accepts. `null` clears a field; an absent key leaves it alone. */
export interface ProfilePatch {
  fullName?: string;
  locale?: 'en-CA' | 'fr-CA';
  email?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  emergencyContact?: EmergencyContact | null;
}

/**
 * AuthClient — high-level auth methods + automatic refresh-on-401.
 *
 * Construct ONCE per app with a SessionStore (mobile: expo-secure-store-backed)
 * and reuse it. The store is updated transparently on verifyOtp / refresh / logout.
 */
export class AuthClient {
  private readonly client: ApiClient;
  private inFlightRefresh: Promise<Session> | null = null;

  constructor(
    private readonly cfg: ClientConfig,
    private readonly store: SessionStore,
  ) {
    this.client = new ApiClient({
      ...cfg,
      getAccessToken: async () => {
        const session = await this.store.load();
        return session?.accessToken ?? null;
      },
    });
  }

  async requestOtp(phone: string): Promise<void> {
    await this.client.request<void>('/v1/auth/otp/request', {
      method: 'POST',
      body: { phone, channel: 'sms' },
    });
  }

  async verifyOtp(phone: string, code: string): Promise<Session> {
    const res = await this.client.request<VerifyOtpResponse>('/v1/auth/otp/verify', {
      method: 'POST',
      body: { phone, code },
    });
    const session: Session = {
      accessToken: res.tokens.accessToken,
      accessExpiresAt: res.tokens.accessExpiresAt,
      refreshToken: res.tokens.refreshToken,
      refreshExpiresAt: res.tokens.refreshExpiresAt,
      user: res.user,
    };
    await this.store.save(session);
    return session;
  }

  async logout(): Promise<void> {
    const session = await this.store.load();
    if (!session) return;
    try {
      await this.client.request<void>('/v1/auth/logout', {
        method: 'POST',
        body: { refreshToken: session.refreshToken },
      });
    } catch {
      // Ignore — clear local state regardless so the user can sign out offline.
    }
    await this.store.clear();
  }

  async me(): Promise<MeResponse> {
    return this.withAutoRefresh(() => this.client.request<MeResponse>('/v1/me'));
  }

  async updateMe(patch: ProfilePatch): Promise<MeResponse> {
    const me = await this.withAutoRefresh(() =>
      this.client.request<MeResponse>('/v1/me', { method: 'PATCH', body: patch }),
    );
    // Patch the persisted session so callers reading session.user.locale see
    // the change immediately without re-fetching /me.
    const current = await this.store.load();
    if (current) {
      await this.store.save({
        ...current,
        user: {
          ...current.user,
          fullName: me.fullName,
          locale: me.locale,
        },
      });
    }
    return me;
  }

  /**
   * Run an API call; if it 401s, attempt a single refresh and retry once.
   * Concurrent 401s share a single refresh promise.
   */
  async withAutoRefresh<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) throw err;
      try {
        await this.refresh();
      } catch (refreshErr) {
        await this.store.clear();
        throw refreshErr;
      }
      return fn();
    }
  }

  async refresh(): Promise<Session> {
    if (this.inFlightRefresh) return this.inFlightRefresh;
    this.inFlightRefresh = (async () => {
      const current = await this.store.load();
      if (!current) throw new ApiError(401, 'no_session', 'No session to refresh.');
      const res = await this.client.request<RefreshResponse>('/v1/auth/refresh', {
        method: 'POST',
        body: { refreshToken: current.refreshToken },
      });
      const next: Session = {
        ...current,
        accessToken: res.tokens.accessToken,
        accessExpiresAt: res.tokens.accessExpiresAt,
        refreshToken: res.tokens.refreshToken,
        refreshExpiresAt: res.tokens.refreshExpiresAt,
      };
      await this.store.save(next);
      return next;
    })();
    try {
      return await this.inFlightRefresh;
    } finally {
      this.inFlightRefresh = null;
    }
  }

  get rawClient(): ApiClient {
    return this.client;
  }
}
