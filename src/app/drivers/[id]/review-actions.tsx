'use client';

/**
 * The decision controls on the review screen.
 *
 * Everything here posts to /api/admin/drivers/* — the dashboard's own proxy —
 * so the operator's bearer token stays in the httpOnly cookie and out of this
 * bundle. Nothing is optimistic: a KYC decision is the one thing on this screen
 * that must never look like it happened when it did not, so a control stays
 * busy until the server has answered AND the Server Component has re-rendered
 * with the new state.
 *
 * Every reason field is validated against the same zod schema the API enforces
 * before the request leaves the browser, so "a reason is required" arrives as a
 * field error under the textarea instead of as a 400 the reviewer has to decode.
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  documentReviewSchema,
  rejectionSchema,
  suspensionSchema,
} from '@uride/validation';
import type { DriverDocumentStatus, KycStatus } from '@uride/types';
import { cn } from '@uride/ui-web';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

type DecisionResult = { ok: true } | { ok: false; message: string };

async function postDecision(path: string, body: unknown): Promise<DecisionResult> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: 'Network error — nothing was recorded. Try again.' };
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
    message: payload?.message ?? 'The decision could not be recorded. Try again.',
  };
}

/**
 * Tracks which control is in flight and keeps everything disabled through the
 * router.refresh() that follows, so a reviewer cannot approve a driver twice by
 * clicking again in the window between the response and the re-render.
 */
function useDecisionRunner() {
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startTransition] = useTransition();

  const run = async (key: string, path: string, body: unknown): Promise<boolean> => {
    setRunning(key);
    setError(null);
    const result = await postDecision(path, body);
    setRunning(null);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  };

  return {
    run,
    error,
    setError,
    running,
    busy: running !== null || isRefreshing,
  };
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

/**
 * The reason prompt.
 *
 * Deliberately a two-step: a reviewer who means to reject has to type why, and
 * a reviewer who clicked the wrong button gets a Cancel. The text is shown to
 * the driver verbatim, which is also why the counter is visible — 500 characters
 * silently truncated upstream would be a half-sentence explanation.
 */
function ReasonForm({
  id,
  label,
  hint,
  confirmLabel,
  pendingLabel,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  id: string;
  label: string;
  hint: string;
  confirmLabel: string;
  pendingLabel: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // The prompt appears on click; focus has to follow it or a keyboard user is
  // left tabbing from the top of the page to find the field they just opened.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border bg-surface-muted/50 p-3">
      <label htmlFor={id} className="block text-sm font-medium text-text">
        {label}
      </label>
      <textarea
        id={id}
        ref={textareaRef}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={500}
        aria-describedby={`${id}-hint`}
        aria-invalid={error ? true : undefined}
        className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text shadow-sm placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <p id={`${id}-hint`} className="text-xs text-text-muted">
        {hint} · {reason.trim().length}/500
      </p>
      {error && <ErrorNote message={error} />}
      <div className="flex gap-2">
        <ActionButton
          variant="danger"
          disabled={busy}
          aria-busy={busy}
          onClick={() => onConfirm(reason)}
        >
          {busy ? pendingLabel : confirmLabel}
        </ActionButton>
        <ActionButton disabled={busy} onClick={onCancel}>
          Cancel
        </ActionButton>
      </div>
    </div>
  );
}

/** First zod complaint, which is the one the reviewer needs to act on. */
function firstIssue(issues: readonly { message: string }[], fallback: string): string {
  return issues[0]?.message ?? fallback;
}

type DriverPrompt = 'reject' | 'suspend' | null;

/**
 * Approve / reject / suspend / reinstate for the driver as a whole.
 *
 * Which controls appear follows the API's own rules rather than a stricter
 * guess: an approved driver can only be suspended, a suspended one can only be
 * reinstated, and everybody else can be approved or rejected. Suspend stays
 * available at every stage of an application — a safety hold is not something
 * to withhold from a reviewer because the paperwork is unfinished.
 */
export function DriverDecisionPanel({
  driverId,
  status,
}: {
  driverId: string;
  status: KycStatus;
}) {
  const { run, error, setError, running, busy } = useDecisionRunner();
  const [prompt, setPrompt] = useState<DriverPrompt>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);

  const base = `/api/admin/drivers/${driverId}`;
  const decidable = status !== 'approved' && status !== 'suspended';

  const openPrompt = (next: DriverPrompt) => {
    setError(null);
    setReasonError(null);
    setPrompt(next);
  };

  const onApprove = () => {
    void run('approve', `${base}/approve`, {});
  };

  const onReinstate = () => {
    void run('reinstate', `${base}/reinstate`, {});
  };

  const onReject = async (reason: string) => {
    const parsed = rejectionSchema.safeParse({ reason });
    if (!parsed.success) {
      setReasonError(
        firstIssue(parsed.error.issues, 'A rejection reason of at least 5 characters is required.'),
      );
      return;
    }
    setReasonError(null);
    if (await run('reject', `${base}/reject`, parsed.data)) setPrompt(null);
  };

  const onSuspend = async (reason: string) => {
    const parsed = suspensionSchema.safeParse({ reason });
    if (!parsed.success) {
      setReasonError(
        firstIssue(parsed.error.issues, 'A suspension reason of at least 5 characters is required.'),
      );
      return;
    }
    setReasonError(null);
    if (await run('suspend', `${base}/suspend`, parsed.data)) setPrompt(null);
  };

  return (
    <section
      aria-labelledby="decision-heading"
      className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <h3 id="decision-heading" className="text-base font-semibold">
        Decision
      </h3>
      <p className="mt-1 text-sm text-text-muted">
        Approval lets this driver go online and carry passengers. Rejection and suspension are shown
        to them in the driver app.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {decidable && (
          <ActionButton
            variant="primary"
            disabled={busy}
            aria-busy={running === 'approve'}
            onClick={onApprove}
          >
            {running === 'approve' ? 'Approving…' : 'Approve driver'}
          </ActionButton>
        )}
        {decidable && (
          <ActionButton
            variant="danger"
            disabled={busy}
            aria-expanded={prompt === 'reject'}
            onClick={() => openPrompt(prompt === 'reject' ? null : 'reject')}
          >
            Reject…
          </ActionButton>
        )}
        {status !== 'suspended' && (
          <ActionButton
            variant="danger"
            disabled={busy}
            aria-expanded={prompt === 'suspend'}
            onClick={() => openPrompt(prompt === 'suspend' ? null : 'suspend')}
          >
            Suspend…
          </ActionButton>
        )}
        {status === 'suspended' && (
          <ActionButton
            variant="primary"
            disabled={busy}
            aria-busy={running === 'reinstate'}
            onClick={onReinstate}
          >
            {running === 'reinstate' ? 'Reinstating…' : 'Reinstate driver'}
          </ActionButton>
        )}
      </div>

      {prompt === 'reject' && (
        <ReasonForm
          key="reject"
          id="reject-reason"
          label="Why is this application rejected?"
          hint="Shown to the driver verbatim. At least 5 characters."
          confirmLabel="Reject application"
          pendingLabel="Rejecting…"
          busy={busy}
          error={reasonError}
          onCancel={() => setPrompt(null)}
          onConfirm={(reason) => void onReject(reason)}
        />
      )}

      {prompt === 'suspend' && (
        <ReasonForm
          key="suspend"
          id="suspend-reason"
          label="Why is this driver suspended?"
          hint="Ends any live session immediately. At least 5 characters."
          confirmLabel="Suspend driver"
          pendingLabel="Suspending…"
          busy={busy}
          error={reasonError}
          onCancel={() => setPrompt(null)}
          onConfirm={(reason) => void onSuspend(reason)}
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
 * Approve / reject one document.
 *
 * Approving every document does not approve the driver, and this control says
 * so by staying separate from the panel above: the reviewer works down the
 * documents, then takes the decision once.
 */
export function DocumentReviewControls({
  driverId,
  documentId,
  documentLabel,
  status,
}: {
  driverId: string;
  documentId: string;
  documentLabel: string;
  status: DriverDocumentStatus;
}) {
  const { run, error, setError, running, busy } = useDecisionRunner();
  const [rejecting, setRejecting] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);

  const path = `/api/admin/drivers/${driverId}/documents/${documentId}/review`;

  const onApprove = () => {
    setError(null);
    void run('approve', path, { decision: 'approve' });
  };

  const onReject = async (reason: string) => {
    const parsed = documentReviewSchema.safeParse({ decision: 'reject', reason });
    if (!parsed.success) {
      setReasonError(
        firstIssue(parsed.error.issues, 'A rejection reason of at least 5 characters is required.'),
      );
      return;
    }
    setReasonError(null);
    if (await run('reject', path, parsed.data)) setRejecting(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <ActionButton
          variant="primary"
          disabled={busy || status === 'approved'}
          aria-busy={running === 'approve'}
          aria-label={`Approve ${documentLabel}`}
          onClick={onApprove}
        >
          {running === 'approve' ? 'Approving…' : 'Approve'}
        </ActionButton>
        <ActionButton
          variant="danger"
          disabled={busy || status === 'rejected'}
          aria-expanded={rejecting}
          aria-label={`Reject ${documentLabel}`}
          onClick={() => {
            setError(null);
            setReasonError(null);
            setRejecting((open) => !open);
          }}
        >
          Reject…
        </ActionButton>
      </div>

      {rejecting && (
        <ReasonForm
          id={`reject-${documentId}`}
          label={`Why is ${documentLabel.toLowerCase()} rejected?`}
          hint="The driver sees this and re-uploads against it. At least 5 characters."
          confirmLabel="Reject document"
          pendingLabel="Rejecting…"
          busy={busy}
          error={reasonError}
          onCancel={() => setRejecting(false)}
          onConfirm={(reason) => void onReject(reason)}
        />
      )}

      {error && <ErrorNote message={error} />}
    </div>
  );
}
