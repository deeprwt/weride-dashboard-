/**
 * POST /api/auth/totp/confirm
 *
 * Completes first-time TOTP enrollment: the user proves they scanned the QR
 * by submitting a 6-digit code generated from the shared secret. On success
 * the upstream returns a full token pair; we set the httpOnly cookies and
 * return only `{ kind: 'tokens', user }` to the browser.
 */
import { NextResponse } from 'next/server';
import { ApiError } from '@uride/api-client';
import { adminTotpConfirmSchema } from '@uride/validation';
import { apiServerFetchAnonymous } from '@/lib/api-server';
import { setAuthCookies, type TokenPair } from '@/lib/cookies';

interface AdminUser {
  id: string;
  email: string;
  roles: string[];
}

interface ConfirmResponse {
  tokens: TokenPair;
  user: AdminUser;
}

export async function POST(req: Request): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { code: 'invalid_body', message: 'Request body must be JSON.' },
      { status: 400 },
    );
  }

  const parsed = adminTotpConfirmSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: 'invalid_input',
        message: 'Invalid confirmation payload.',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await apiServerFetchAnonymous<ConfirmResponse>(
      '/v1/auth/admin/totp/confirm',
      { method: 'POST', body: parsed.data },
    );
    await setAuthCookies(result.tokens);
    return NextResponse.json({ kind: 'tokens', user: result.user }, { status: 200 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { code: err.code, message: err.message, details: err.details },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { code: 'upstream_error', message: 'Confirmation service unavailable.' },
      { status: 502 },
    );
  }
}
