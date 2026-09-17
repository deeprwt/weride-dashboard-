/**
 * /api/admin/drivers/* — the browser's only door to the KYC endpoints.
 *
 * The review screen is interactive, so the decisions and the document scans
 * have to be reachable from the browser. They are NOT reachable with a bearer
 * token: the access token lives in an httpOnly cookie precisely so that page
 * JavaScript — ours, a dependency's, or an injected one — can never read it,
 * and handing it to an <img src> or a fetch() to the API would undo that for
 * the sake of one request. Every call goes through this handler instead, which
 * re-attaches the bearer server-side.
 *
 * The path is allowlisted rather than forwarded blind. A catch-all proxy that
 * appends whatever it is given turns the dashboard's session into a general
 * key to the core API; this one only speaks the six routes the review screen
 * actually uses — one stream and five decisions — and 404s everything else.
 * The reads are absent on purpose: the queue and the review screen fetch those
 * server-side, and a decision returns the updated application in its response.
 */
import { NextResponse } from 'next/server';
import { ADMIN_DRIVERS_PATH, ApiError } from '@uride/api-client';
import {
  DRIVER_DOCUMENT_MIME_TYPES,
  approvalSchema,
  documentReviewSchema,
  rejectionSchema,
  suspensionSchema,
} from '@uride/validation';
import type { AdminDriverDetail } from '@uride/types';
import { API_BASE_URL, apiServerFetch } from '@/lib/api-server';
import {
  clearAuthCookies,
  readAccessCookie,
  readRefreshCookie,
  setAuthCookies,
  type TokenPair,
} from '@/lib/cookies';

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The schemas this handler validates against, typed from the schemas themselves
 * so the dashboard never declares a zod dependency of its own to describe them.
 */
type DecisionSchema =
  | typeof approvalSchema
  | typeof rejectionSchema
  | typeof suspensionSchema
  | typeof documentReviewSchema;

/**
 * POST actions on a driver, each with the schema the API will hold us to.
 *
 * A Map rather than an object literal: `'constructor' in someObject` is true,
 * and an allowlist that answers yes to inherited keys is not an allowlist.
 */
const DRIVER_ACTIONS = new Map<string, DecisionSchema>([
  ['approve', approvalSchema],
  ['reject', rejectionSchema],
  ['suspend', suspensionSchema],
  ['reinstate', approvalSchema],
]);

function notAllowed(): NextResponse {
  return NextResponse.json(
    { code: 'route_not_proxied', message: 'This admin route is not proxied.' },
    { status: 404 },
  );
}

function fromApiError(err: unknown, fallback: string): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { code: err.code, message: err.message, details: err.details },
      { status: err.status },
    );
  }
  return NextResponse.json({ code: 'upstream_error', message: fallback }, { status: 502 });
}

/**
 * Match `<driverId>/documents/<documentId>/<tail>` and hand back the two ids.
 *
 * Destructuring rather than indexing is what makes this typecheck under
 * `noUncheckedIndexedAccess`: `path[0]` is `string | undefined` no matter how
 * recently `path.length` was tested, because TypeScript does not relate a
 * length check to element definedness. Naming the elements once, here, also
 * means the shape of this URL is asserted in exactly one place instead of
 * being re-spelled in every handler.
 */
function matchDocumentRoute(
  path: string[],
  tail: 'file' | 'review',
): { driverId: string; documentId: string } | null {
  const [driverId, documents, documentId, last] = path;
  if (
    path.length === 4 &&
    driverId !== undefined &&
    documentId !== undefined &&
    UUID_RE.test(driverId) &&
    documents === 'documents' &&
    UUID_RE.test(documentId) &&
    last === tail
  ) {
    return { driverId, documentId };
  }
  return null;
}

/** Match `<driverId>/<action>` for the whole-driver decisions. */
function matchDriverAction(
  path: string[],
): { driverId: string; action: string } | null {
  const [driverId, action] = path;
  if (path.length === 2 && driverId !== undefined && action !== undefined && UUID_RE.test(driverId)) {
    return { driverId, action };
  }
  return null;
}

/** GET — the document bytes behind every preview on the review screen. */
export async function GET(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { path } = await ctx.params;

  const doc = matchDocumentRoute(path, 'file');
  if (doc) {
    return proxyDocument(
      `${ADMIN_DRIVERS_PATH}/${doc.driverId}/documents/${doc.documentId}/file`,
    );
  }

  return notAllowed();
}

/** POST — the five decisions: approve, reject, suspend, reinstate, review a document. */
export async function POST(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { path } = await ctx.params;

  const driverAction = matchDriverAction(path);
  if (driverAction) {
    const schema = DRIVER_ACTIONS.get(driverAction.action);
    if (schema) {
      return proxyDecision(
        req,
        `${ADMIN_DRIVERS_PATH}/${driverAction.driverId}/${driverAction.action}`,
        schema,
      );
    }
  }

  const doc = matchDocumentRoute(path, 'review');
  if (doc) {
    return proxyDecision(
      req,
      `${ADMIN_DRIVERS_PATH}/${doc.driverId}/documents/${doc.documentId}/review`,
      documentReviewSchema,
    );
  }

  return notAllowed();
}

/**
 * Validate here as well as upstream.
 *
 * Not distrust of the API — it validates the same schemas and is the gate that
 * counts. It is that a reviewer who leaves the rejection reason blank should
 * see that in the form, not as a round trip that returns a 400 they have to
 * interpret, and the shared zod schema is the only definition of "blank" that
 * cannot drift from the one the API enforces.
 */
async function proxyDecision(
  req: Request,
  upstreamPath: string,
  schema: DecisionSchema,
): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { code: 'invalid_body', message: 'Request body must be JSON.' },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: 'invalid_input',
        message: parsed.error.issues[0]?.message ?? 'Invalid decision payload.',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const detail = await apiServerFetch<AdminDriverDetail>(upstreamPath, {
      method: 'POST',
      body: parsed.data,
    });
    return NextResponse.json(detail, { status: 200 });
  } catch (err) {
    return fromApiError(err, 'The driver service is unavailable.');
  }
}

/**
 * Stream a document through, rather than buffering it.
 *
 * apiServerFetch is deliberately not used here: it reads the whole response as
 * text to parse it, which both mangles binary bytes and pulls a 10 MB scan into
 * the server's heap for every preview a reviewer opens. The cost of piping the
 * body straight through is that the refresh-on-401 dance has to be repeated
 * below — a small duplication in exchange for never holding a licence photo in
 * memory.
 */
async function proxyDocument(upstreamPath: string): Promise<NextResponse> {
  const accessToken = await readAccessCookie();
  let upstream = await fetchDocument(upstreamPath, accessToken);

  if (upstream.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      return NextResponse.json(
        { code: 'session_expired', message: 'Your session has expired. Sign in again.' },
        { status: 401 },
      );
    }
    upstream = await fetchDocument(upstreamPath, refreshed);
  }

  if (!upstream.ok) {
    // Upstream errors are JSON; pass the body through so the reviewer sees
    // "Document not found" rather than a blank frame.
    const body = await upstream.text();
    return new NextResponse(body || null, {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    });
  }

  const headers = new Headers();
  headers.set('content-type', safeContentType(upstream.headers.get('content-type')));
  const length = upstream.headers.get('content-length');
  if (length) headers.set('content-length', length);
  const disposition = upstream.headers.get('content-disposition');
  if (disposition) headers.set('content-disposition', disposition);
  // Government ID: never cached by a proxy, never persisted by the browser,
  // and never sniffed into something the browser would rather execute.
  headers.set('cache-control', 'private, no-store, max-age=0');
  headers.set('x-content-type-options', 'nosniff');

  return new NextResponse(upstream.body, { status: 200, headers });
}

function fetchDocument(upstreamPath: string, accessToken: string | null): Promise<Response> {
  return fetch(new URL(upstreamPath, API_BASE_URL), {
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
    cache: 'no-store',
  });
}

/**
 * The API only accepts the four upload types, so anything else on the way back
 * is a mismatch — and serving an unexpected type inline from our own origin is
 * how a stored file becomes a script running as the operator.
 */
function safeContentType(raw: string | null): string {
  const mime = raw?.split(';')[0]?.trim().toLowerCase() ?? '';
  const allowed = (DRIVER_DOCUMENT_MIME_TYPES as readonly string[]).includes(mime);
  return allowed ? mime : 'application/octet-stream';
}

/** One-shot refresh mirroring api-server's, for the streaming path that cannot use it. */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await readRefreshCookie();
  if (!refreshToken) return null;

  const res = await fetch(new URL('/v1/auth/refresh', API_BASE_URL), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  if (!res.ok) {
    await clearAuthCookies();
    return null;
  }

  const { tokens } = (await res.json()) as { tokens: TokenPair };
  await setAuthCookies(tokens);
  return tokens.accessToken;
}
