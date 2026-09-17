/**
 * Server-side API helper.
 *
 * Reads the access token from the httpOnly cookie, attaches it as a Bearer to
 * the upstream NestJS API call, and transparently performs ONE refresh-and-retry
 * on a 401. If the refresh fails, both cookies are cleared and an ApiError(401)
 * is thrown so callers (Server Components, Route Handlers) can redirect to /login.
 *
 * Never import this from a Client Component — it uses `next/headers`.
 */
import { ApiError } from '@uride/api-client';
import {
  clearAuthCookies,
  readAccessCookie,
  readRefreshCookie,
  setAuthCookies,
  type TokenPair,
} from './cookies';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export interface ServerFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** If true, do not attempt the refresh-on-401 flow. */
  skipAuthRefresh?: boolean;
}

interface ApiErrorPayload {
  code?: string;
  message?: string;
  details?: unknown;
}

function buildUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalized, API_BASE_URL).toString();
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function throwApiError(status: number, payload: unknown, fallback: string): never {
  const err = (payload ?? {}) as ApiErrorPayload;
  throw new ApiError(
    status,
    err.code ?? 'unknown_error',
    err.message ?? fallback,
    err.details,
  );
}

async function rawFetch<T>(
  path: string,
  opts: ServerFetchOptions,
  accessToken: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(opts.headers ?? {}),
  };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;

  const res = await fetch(buildUrl(path), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });

  const data = await parseBody(res);
  if (!res.ok) throwApiError(res.status, data, res.statusText);
  return data as T;
}

interface RefreshResponse {
  tokens: TokenPair;
}

/** Calls /v1/auth/refresh with the current refresh cookie. Persists new tokens on success. */
async function refreshTokens(): Promise<string> {
  const refreshToken = await readRefreshCookie();
  if (!refreshToken) {
    throw new ApiError(401, 'no_session', 'No refresh token available.');
  }
  const res = await fetch(buildUrl('/v1/auth/refresh'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  const data = await parseBody(res);
  if (!res.ok) throwApiError(res.status, data, 'Token refresh failed.');
  const refreshed = data as RefreshResponse;
  await setAuthCookies(refreshed.tokens);
  return refreshed.tokens.accessToken;
}

/**
 * Server-side fetch with bearer-from-cookie + refresh-on-401.
 *
 * Throws ApiError on non-2xx responses. On a 401 it will attempt exactly one
 * refresh; if that fails, cookies are cleared before the error propagates.
 */
export async function apiServerFetch<T>(
  path: string,
  opts: ServerFetchOptions = {},
): Promise<T> {
  const accessToken = await readAccessCookie();
  try {
    return await rawFetch<T>(path, opts, accessToken);
  } catch (err) {
    if (opts.skipAuthRefresh) throw err;
    if (!(err instanceof ApiError) || err.status !== 401) throw err;

    let nextAccess: string;
    try {
      nextAccess = await refreshTokens();
    } catch (refreshErr) {
      await clearAuthCookies();
      throw refreshErr instanceof ApiError
        ? refreshErr
        : new ApiError(401, 'refresh_failed', 'Session expired.');
    }
    return rawFetch<T>(path, opts, nextAccess);
  }
}

/**
 * Lightweight passthrough used by route handlers that already validated input.
 * Skips the bearer attachment + refresh logic — appropriate for the public
 * login / enroll / confirm endpoints.
 */
export async function apiServerFetchAnonymous<T>(
  path: string,
  opts: ServerFetchOptions = {},
): Promise<T> {
  return rawFetch<T>(path, opts, null);
}

export { API_BASE_URL };
