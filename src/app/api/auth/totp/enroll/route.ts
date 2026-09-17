/**
 * POST /api/auth/totp/enroll
 *
 * Proxies the admin TOTP enrollment endpoint. Returns the QR data URL,
 * shared secret, otpauth URL and recovery codes verbatim — the client
 * needs all of them to show the user. No cookies are set; enrollment
 * only succeeds once the user confirms a code via /api/auth/totp/confirm.
 */
import { NextResponse } from 'next/server';
import { ApiError } from '@uride/api-client';
import { adminTotpEnrollSchema } from '@uride/validation';
import { apiServerFetchAnonymous } from '@/lib/api-server';

interface EnrollResponse {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
  recoveryCodes: string[];
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

  const parsed = adminTotpEnrollSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: 'invalid_input',
        message: 'Invalid enrollment payload.',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await apiServerFetchAnonymous<EnrollResponse>(
      '/v1/auth/admin/totp/enroll',
      { method: 'POST', body: parsed.data },
    );
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { code: err.code, message: err.message, details: err.details },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { code: 'upstream_error', message: 'Enrollment service unavailable.' },
      { status: 502 },
    );
  }
}
