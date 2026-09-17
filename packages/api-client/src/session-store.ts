/**
 * Platform-agnostic session storage interface.
 *
 * Mobile (rider/driver-app): backed by expo-secure-store (Keychain/Keystore).
 * Web (admin-web): backed by httpOnly cookies — the SessionStore for admin
 *   never holds tokens in JS; only the server reads them. This interface is
 *   therefore mobile-facing in practice.
 */

export interface Session {
  accessToken: string;
  accessExpiresAt: string; // ISO
  refreshToken: string;
  refreshExpiresAt: string; // ISO
  user: {
    id: string;
    phone: string | null;
    email: string | null;
    fullName: string | null;
    /** User's chosen locale — drives the t() dictionary on every client. */
    locale: 'en-CA' | 'fr-CA';
    roles: string[];
  };
}

export interface SessionStore {
  load(): Promise<Session | null>;
  save(session: Session): Promise<void>;
  clear(): Promise<void>;
}
