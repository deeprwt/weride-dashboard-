'use client';

/**
 * The two interventions an operator can make on a live ride.
 *
 * Everything here posts to /api/admin/rides/* — the dashboard's own proxy — so
 * the operator's bearer token stays in the httpOnly cookie and out of this
 * bundle. Nothing is optimistic: reassigning a ride moves a real person between
 * two real cars, and a control that looked like it worked when it did not would
 * have an operator telling a rider a different driver is coming when nobody is.
 * A control stays busy until the server has answered AND the Server Component
 * has re-rendered with the new state.
 *
 * Both forms are validated against the same zod schemas the API enforces before
 * the request leaves the browser, so "a reason is required" arrives as a field
 * error under the textarea instead of as a 400 the operator has to decode.
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { rideCancelSchema, rideReassignSchema } from '@uride/validation';
import type { AdminRideCandidate } from '@uride/types';
import { cn } from '@uride/ui-web';
import { formatDistanceMeters } from '@/components/format';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

type ActionResult = { ok: true } | { ok: false; message: string };

/** Cancellation reasons, phrased for the person clicking rather than for the rider. */
const CANCEL_REASONS: readonly { value: string; label: string }[] = [
  { value: 'driver_too_far', label: 'No driver is reachable' },
  { value: 'safety_concern', label: 'Safety concern' },
  { value: 'wrong_pickup', label: 'Wrong pickup' },
  { value: 'wrong_destination', label: 'Wrong destination' },
  { value: 'rider_changed_mind', label: 'Rider asked us to cancel' },
  { value: 'other', label: 'Other' },
];

async function postAction(path: string, body: unknown): Promise<ActionResult> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: 'Network error — nothing was changed. Try again.' };
  }

  if (res.ok) return { ok: true };

  let payload: ApiErrorBody | null = null;
  try {
    payload = (await res.json()) as ApiErrorBody;
  } catch {
    payload = null;
  }
  return {
    ok: false,
    message: payload?.message ?? 'The change could not be applied. Try again.',
  };
}

/**
 * Tracks which control is in flight and keeps everything disabled through the
 * router.refresh() that follows, so an operator cannot fire a second
 * intervention in the window between the response and the re-render — which on
 * this screen would mean cancelling a ride they have just reassigned.
 */
function useActionRunner() {
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startTransition] = useTransition();

  const run = async (key: string, path: string, body: unknown): Promise<boolean> => {
    setRunning(key);
    setError(null);
    const result = await postAction(path, body);
    setRunning(null);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  };

  return { run, error, setError, running, busy: running !== null || isRefreshing };
}

const BUTTON_BASE =
  'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition ' +
  'disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

const BUTTON_VARIANTS = {
  primary: 'bg-primary text-primary-text hover:opacity-95',
  neutral: 'border border-border bg-surface text-text hover:bg-surface-muted',
  danger: 'border border-danger-500/50 bg-surface text-danger-700 hover:bg-danger-500/10',
} as const;

const FIELD_CLASS =
  'w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text shadow-sm ' +
  'placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary';

function ActionButton({
  variant = 'neutral',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
}) {
  return (
    <button
      type="button"
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], className)}
      {...props}
    />
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-danger-500/40 bg-danger-500/5 px-3 py-2 text-sm text-text"
    >
      {message}
    </p>
  );
}

/** First zod complaint, which is the one the operator needs to act on. */
function firstIssue(issues: readonly { message: string }[], fallback: string): string {
  return issues[0]?.message ?? fallback;
}

type Prompt = 'reassign' | 'cancel' | null;

export function RideActions({
  rideId,
  candidates,
  canReassign,
  canCancel,
  hasDriver,
}: {
  rideId: string;
  candidates: AdminRideCandidate[];
  canReassign: boolean;
  canCancel: boolean;
  hasDriver: boolean;
}) {
  const { run, error, setError, running, busy } = useActionRunner();
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const base = `/api/admin/rides/${rideId}`;

  const openPrompt = (next: Prompt) => {
    setError(null);
    setFieldError(null);
    setPrompt((current) => (current === next ? null : next));
  };

  const onReassign = async (driverId: string, reason: string) => {
    const parsed = rideReassignSchema.safeParse({ driverId, reason });
    if (!parsed.success) {
      setFieldError(
        firstIssue(parsed.error.issues, 'Pick a driver and say why, in at least 5 characters.'),
      );
      return;
    }
    setFieldError(null);
    if (await run('reassign', `${base}/reassign`, parsed.data)) setPrompt(null);
  };

  const onCancel = async (reason: string, note: string) => {
    const parsed = rideCancelSchema.safeParse({
      reason,
      // An empty textarea is "no note", not an empty note: the schema caps the
      // length but has nothing to say about a blank string, and a row of empty
      // strings in the audit trail is worse than a null.
      note: note.trim() ? note.trim() : undefined,
    });
    if (!parsed.success) {
      setFieldError(firstIssue(parsed.error.issues, 'Pick a reason for the cancellation.'));
      return;
    }
    setFieldError(null);
    if (await run('cancel', `${base}/cancel`, parsed.data)) setPrompt(null);
  };

  return (
    <section
      aria-labelledby="actions-heading"
      className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <h3 id="actions-heading" className="text-base font-semibold">
        Intervene
      </h3>
      <p className="mt-1 text-sm text-text-muted">
        Both actions are recorded against your account and appear in this ride&rsquo;s event trail.
      </p>

      {!canReassign && !canCancel ? (
        <p className="mt-4 text-sm text-text-muted">
          This ride is finished — there is nothing left to change. A completed trip is refunded
          through payments, not cancelled here.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {canReassign && (
            <ActionButton
              variant="primary"
              disabled={busy}
              aria-expanded={prompt === 'reassign'}
              onClick={() => openPrompt('reassign')}
            >
              {hasDriver ? 'Reassign driver…' : 'Assign a driver…'}
            </ActionButton>
          )}
          {canCancel && (
            <ActionButton
              variant="danger"
              disabled={busy}
              aria-expanded={prompt === 'cancel'}
              onClick={() => openPrompt('cancel')}
            >
              Cancel ride…
            </ActionButton>
          )}
        </div>
      )}

      {prompt === 'reassign' && (
        <ReassignForm
          candidates={candidates}
          busy={busy}
          pending={running === 'reassign'}
          error={fieldError}
          onCancel={() => setPrompt(null)}
          onConfirm={(driverId, reason) => void onReassign(driverId, reason)}
        />
      )}

      {prompt === 'cancel' && (
        <CancelForm
          busy={busy}
          pending={running === 'cancel'}
          error={fieldError}
          hasDriver={hasDriver}
          onDismiss={() => setPrompt(null)}
          onConfirm={(reason, note) => void onCancel(reason, note)}
        />
      )}

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}
    </section>
  );
}

/**
 * Pick a driver, say why.
 *
 * The list comes from the API's own candidate search — approved, online, near
 * the pickup, pinged in the last minute — rather than from a free-text id
 * field. A reassignment is only as good as the driver it names, and the one
 * failure mode worth designing out is handing a stranded rider to somebody who
 * ended their shift twenty minutes ago.
 */
function ReassignForm({
  candidates,
  busy,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  candidates: AdminRideCandidate[];
  busy: boolean;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (driverId: string, reason: string) => void;
}) {
  const [driverId, setDriverId] = useState(candidates[0]?.driver.id ?? '');
  const [reason, setReason] = useState('');
  const selectRef = useRef<HTMLSelectElement | null>(null);

  // The form appears on click; focus has to follow it or a keyboard user is
  // left tabbing from the top of the page to find the field they just opened.
  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  if (candidates.length === 0) {
    return (
      <div className="mt-3 space-y-3 rounded-lg border border-border bg-surface-muted/50 p-3">
        <p className="text-sm text-text">
          No approved driver is online within 8 km of the pickup right now, so there is nobody to
          hand this ride to. Cancelling frees the rider to re-book somewhere the fleet is.
        </p>
        <ActionButton onClick={onCancel}>Close</ActionButton>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border bg-surface-muted/50 p-3">
      <label htmlFor="reassign-driver" className="block text-sm font-medium text-text">
        Give this ride to
      </label>
      <select
        id="reassign-driver"
        ref={selectRef}
        value={driverId}
        onChange={(e) => setDriverId(e.target.value)}
        className={FIELD_CLASS}
      >
        {candidates.map((candidate) => (
          <option key={candidate.driver.id} value={candidate.driver.id}>
            {candidate.driver.fullName ?? 'Unnamed driver'} ·{' '}
            {formatDistanceMeters(candidate.distanceMeters)} away
            {candidate.ratingAvg === null ? '' : ` · ${candidate.ratingAvg.toFixed(2)}★`}
          </option>
        ))}
      </select>

      <label htmlFor="reassign-reason" className="block pt-2 text-sm font-medium text-text">
        Why is this ride being moved?
      </label>
      <textarea
        id="reassign-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={500}
        aria-describedby="reassign-reason-hint"
        aria-invalid={error ? true : undefined}
        className={FIELD_CLASS}
      />
      <p id="reassign-reason-hint" className="text-xs text-text-muted">
        Kept in the audit trail and the ride&rsquo;s event log. At least 5 characters ·{' '}
        {reason.trim().length}/500
      </p>

      {error && <ErrorNote message={error} />}

      <div className="flex gap-2">
        <ActionButton
          variant="primary"
          disabled={busy}
          aria-busy={pending}
          onClick={() => onConfirm(driverId, reason)}
        >
          {pending ? 'Reassigning…' : 'Reassign ride'}
        </ActionButton>
        <ActionButton disabled={busy} onClick={onCancel}>
          Cancel
        </ActionButton>
      </div>
    </div>
  );
}

/**
 * End the ride.
 *
 * A two-step on purpose: an operator who means to cancel has to choose a reason
 * first, and one who hit the wrong button gets a way out. The reason vocabulary
 * is the platform's existing cancellation enum, so an ops cancellation can be
 * compared with a rider's own in the same report.
 */
function CancelForm({
  busy,
  pending,
  error,
  hasDriver,
  onDismiss,
  onConfirm,
}: {
  busy: boolean;
  pending: boolean;
  error: string | null;
  hasDriver: boolean;
  onDismiss: () => void;
  onConfirm: (reason: string, note: string) => void;
}) {
  const [reason, setReason] = useState(CANCEL_REASONS[0]?.value ?? 'other');
  const [note, setNote] = useState('');
  const selectRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-danger-500/40 bg-danger-500/5 p-3">
      <p className="text-sm text-text">
        The rider is told the ride is cancelled.{' '}
        {hasDriver
          ? 'The assigned driver is released and goes back into dispatch immediately.'
          : 'Any offer still out with a driver is withdrawn.'}
      </p>

      <label htmlFor="cancel-reason" className="block pt-2 text-sm font-medium text-text">
        Reason
      </label>
      <select
        id="cancel-reason"
        ref={selectRef}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className={FIELD_CLASS}
      >
        {CANCEL_REASONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label htmlFor="cancel-note" className="block pt-2 text-sm font-medium text-text">
        Note <span className="font-normal text-text-muted">(optional)</span>
      </label>
      <textarea
        id="cancel-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={500}
        aria-describedby="cancel-note-hint"
        aria-invalid={error ? true : undefined}
        className={FIELD_CLASS}
      />
      <p id="cancel-note-hint" className="text-xs text-text-muted">
        What the ticket says, for whoever reads this months later · {note.trim().length}/500
      </p>

      {error && <ErrorNote message={error} />}

      <div className="flex gap-2">
        <ActionButton
          variant="danger"
          disabled={busy}
          aria-busy={pending}
          onClick={() => onConfirm(reason, note)}
        >
          {pending ? 'Cancelling…' : 'Cancel this ride'}
        </ActionButton>
        <ActionButton disabled={busy} onClick={onDismiss}>
          Keep the ride
        </ActionButton>
      </div>
    </div>
  );
}
