/**
 * Auth gate. Runs on every non-static path and redirects unauthenticated
 * users to /login. We only check for the presence of the access cookie here —
 * actual JWT validation is the responsibility of Server Components and Route
 * Handlers (which talk to the API and can refresh tokens). Edge middleware
 * deliberately stays simple and fast.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE } from './lib/cookies';

/** Paths the middleware never gates. */
const PUBLIC_PATHS: readonly string[] = [
  '/login',
  '/login/totp/enroll',
];

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/api/auth/')) return true;
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname, search } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const hasSession = req.cookies.has(ACCESS_COOKIE);
  if (hasSession) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  // Preserve where they were going so we can return there after login.
  // TODO(phase-2): consume `?next=` on the login form to honor the deep link.
  if (pathname && pathname !== '/') {
    loginUrl.searchParams.set('next', `${pathname}${search}`);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  /**
   * Run on every path EXCEPT Next internals and static assets. We can't list
   * `/api/auth/*` here because we still want middleware to skip it explicitly
   * (handled in `isPublicPath`) — this matcher just excludes things that should
   * never be gated under any circumstance.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
