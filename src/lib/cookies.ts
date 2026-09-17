/**
 * Auth cookie helpers.
 *
 * Tokens are stored in httpOnly cookies so they never reach the browser's JS.
 * Only Route Handlers and Server Components can read/write them. The browser
 * sends them automatically with same-origin requests to our API routes.
 *
 * TODO(phase-2): scope the refresh cookie to `path: '/api/auth/refresh'` so
 * it never travels with normal admin requests. Keeping it at '/' for Phase 1
 * to simplify the route-handler set.
 */
import { cookies } from 'next/headers';

export const ACCESS_COOKIE = 'uride_access';
export const REFRESH_COOKIE = 'uride_refresh';

export interface TokenPair {
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
}

type SameSite = 'strict' | 'lax' | 'none';

interface CookieBaseOptions {
  httpOnly: true;
  sameSite: SameSite;
  secure: boolean;
  path: string;
}

function baseOptions(): CookieBaseOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

/** Convert an ISO timestamp to a maxAge (seconds) relative to now. Clamps to >=0. */
function maxAgeFromIso(iso: string): number {
  const target = Date.parse(iso);
  if (Number.isNaN(target)) return 0;
  const seconds = Math.floor((target - Date.now()) / 1000);
  return seconds > 0 ? seconds : 0;
}

/** Persist both auth cookies from a fresh token pair. */
export async function setAuthCookies(tokens: TokenPair): Promise<void> {
  const jar = await cookies();
  jar.set({
    name: ACCESS_COOKIE,
    value: tokens.accessToken,
    ...baseOptions(),
    maxAge: maxAgeFromIso(tokens.accessExpiresAt),
  });
  jar.set({
    name: REFRESH_COOKIE,
    value: tokens.refreshToken,
    ...baseOptions(),
    maxAge: maxAgeFromIso(tokens.refreshExpiresAt),
  });
}

/** Remove both auth cookies (logout / refresh failure). */
export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies();
  // Setting maxAge=0 with the same attributes is the most reliable cross-browser
  // way to clear an httpOnly cookie from a Server context.
  jar.set({ name: ACCESS_COOKIE, value: '', ...baseOptions(), maxAge: 0 });
  jar.set({ name: REFRESH_COOKIE, value: '', ...baseOptions(), maxAge: 0 });
}

export async function readAccessCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ACCESS_COOKIE)?.value ?? null;
}

export async function readRefreshCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value ?? null;
}
