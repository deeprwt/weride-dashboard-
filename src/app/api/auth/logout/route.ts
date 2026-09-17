/**
 * POST /api/auth/logout
 *
 * Best-effort sign-out: tells the upstream API to revoke the refresh token,
 * then clears the local httpOnly cookies regardless of upstream success.
 * Returns 204 — the client redirects after.
 */
import { NextResponse } from 'next/server';
import { apiServerFetch } from '@/lib/api-server';
import { clearAuthCookies, readRefreshCookie } from '@/lib/cookies';

export async function POST(): Promise<NextResponse> {
  const refreshToken = await readRefreshCookie();

  try {
    await apiServerFetch<void>('/v1/auth/logout', {
      method: 'POST',
      body: refreshToken ? { refreshToken } : {},
      skipAuthRefresh: true,
    });
  } catch {
    // Intentional: we always clear local cookies so the user can sign out
    // even if the API is unreachable or already invalidated the session.
  }

  await clearAuthCookies();
  return new NextResponse(null, { status: 204 });
}
