/**
 * /api/admin/rides/* — the browser's only door to the dispatch endpoints.
 *
 * The ride screen is interactive, so reassigning and cancelling have to be
 * reachable from the browser. They are NOT reachable with a bearer token: the
 * access token lives in an httpOnly cookie precisely so that page JavaScript —
 * ours, a dependency's, or an injected one — can never read it, and handing it
 * to a fetch() against the core API would undo that for the sake of two
 * requests. Both calls go through this handler instead, which re-attaches the
 * bearer server-side.
 *
 * The path is allowlisted rather than forwarded blind. A catch-all proxy that
 * appends whatever it is given turns the dashboard's session into a general key
 * to the core API; this one speaks the two interventions the ride screen uses
 * and 404s everything else. There is deliberately no GET: the board and the
 * detail page are Server Components that read with the cookie directly, and an
 * intervention returns the updated ride in its own response.
 */
import { NextResponse } from 'next/server';
import { ADMIN_RIDES_PATH, ApiError } from '@uride/api-client';
import { rideCancelSchema, rideReassignSchema } from '@uride/validation';
import type { AdminRideDetail } from '@uride/types';
import { apiServerFetch } from '@/lib/api-server';

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The schemas this handler validates against, typed from the schemas themselves
 * so the dashboard never declares a zod dependency of its own to describe them.
 */
type ActionSchema = typeof rideReassignSchema | typeof rideCancelSchema;

/**
 * POST actions on a ride, each with the schema the API will hold us to.
 *
 * A Map rather than an object literal: `'constructor' in someObject` is true,
 * and an allowlist that answers yes to inherited keys is not an allowlist.
 */
const RIDE_ACTIONS = new Map<string, ActionSchema>([
  ['reassign', rideReassignSchema],
  ['cancel', rideCancelSchema],
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
 * Match `<rideId>/<action>` and hand back both halves.
 *
 * Destructuring rather than indexing is what makes this typecheck under
 * `noUncheckedIndexedAccess`: `path[0]` is `string | undefined` no matter how
 * recently `path.length` was tested, because TypeScript does not relate a
 * length check to element definedness. Naming the elements once, here, also
 * means the shape of this URL is asserted in exactly one place.
 */
function matchRideAction(path: string[]): { rideId: string; action: string } | null {
  const [rideId, action] = path;
  if (path.length === 2 && rideId !== undefined && action !== undefined && UUID_RE.test(rideId)) {
    return { rideId, action };
  }
  return null;
}

/** POST — the two interventions: reassign the driver, or end the ride. */
export async function POST(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { path } = await ctx.params;

  const rideAction = matchRideAction(path);
  if (rideAction) {
    const schema = RIDE_ACTIONS.get(rideAction.action);
    if (schema) {
      return proxyAction(
        req,
        `${ADMIN_RIDES_PATH}/${rideAction.rideId}/${rideAction.action}`,
        schema,
      );
    }
  }

  return notAllowed();
}

/**
 * Validate here as well as upstream.
 *
 * Not distrust of the API — it validates the same schemas and is the gate that
 * counts. It is that an operator who leaves the reassignment reason blank
 * should see that under the textarea, not as a round trip that returns a 400
 * they have to interpret, and the shared zod schema is the only definition of
 * "blank" that cannot drift from the one the API enforces.
 */
async function proxyAction(
  req: Request,
  upstreamPath: string,
  schema: ActionSchema,
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
        message: parsed.error.issues[0]?.message ?? 'Invalid dispatch payload.',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const detail = await apiServerFetch<AdminRideDetail>(upstreamPath, {
      method: 'POST',
      body: parsed.data,
    });
    return NextResponse.json(detail, { status: 200 });
  } catch (err) {
    return fromApiError(err, 'The dispatch service is unavailable.');
  }
}
