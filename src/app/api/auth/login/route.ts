/**
 * POST /api/auth/login
 *
 * Browser-facing proxy for the admin login endpoint. We validate the body with
 * the shared zod schema, forward to the NestJS API, and — on full success —
 * set the httpOnly auth cookies before returning to the browser. Tokens are
 * NEVER sent back in the JSON body; the browser only learns whether more
 * input (TOTP) or a side trip (enrollment) is required.
 */
import { NextResponse } from 'next/server';
import { ApiError } from '@uride/api-client';
import { adminLoginSchema } from '@uride/validation';
import { apiServerFetchAnonymous } from '@/lib/api-server';
import { setAuthCookies, type TokenPair } from '@/lib/cookies';

interface AdminUser {
  id: string;
  email: string;
  roles: string[];
}

type AdminLoginResponse =
  | { kind: 'tokens'; tokens: TokenPair; user: AdminUser }
  | { kind: 'totp_required' }
  | { kind: 'totp_enrollment_required' };

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

  const parsed = adminLoginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: 'invalid_input',
        message: 'Invalid login payload.',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await apiServerFetchAnonymous<AdminLoginResponse>(
      '/v1/auth/admin/login',
      { method: 'POST', body: parsed.data },
    );

    if (result.kind === 'tokens') {
      await setAuthCookies(result.tokens);
      // Do NOT echo the tokens back — they're already in httpOnly cookies.
      return NextResponse.json({ kind: 'tokens', user: result.user }, { status: 200 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { code: err.code, message: err.message, details: err.details },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { code: 'upstream_error', message: 'Authentication service unavailable.' },
      { status: 502 },
    );
  }
}
