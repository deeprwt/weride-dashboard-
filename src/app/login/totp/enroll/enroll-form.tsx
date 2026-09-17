'use client';

/**
 * EnrollForm — three-step flow:
 *   1. Collect email + password (we don't carry them across pages).
 *   2. POST /api/auth/totp/enroll, render QR + secret + recovery codes.
 *   3. POST /api/auth/totp/confirm with the same creds + a 6-digit code.
 *
 * Step 3 is the only step that produces an authenticated session.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  adminTotpConfirmSchema,
  adminTotpEnrollSchema,
  type AdminTotpConfirmInput,
  type AdminTotpEnrollInput,
} from '@uride/validation';
import { cn } from '@uride/ui-web';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

interface EnrollPayload {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
  recoveryCodes: string[];
}

type Stage = 'credentials' | 'verify';

export function EnrollForm() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('credentials');
  const [enrollData, setEnrollData] = useState<EnrollPayload | null>(null);
  const [credentials, setCredentials] = useState<AdminTotpEnrollInput | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  if (stage === 'credentials') {
    return (
      <CredentialsStep
        onEnrolled={(creds, data) => {
          setCredentials(creds);
          setEnrollData(data);
          setServerError(null);
          setStage('verify');
        }}
      />
    );
  }

  if (!enrollData || !credentials) {
    // Defensive — should be unreachable. Render nothing rather than calling
    // a setter during render; the user can retry from /login.
    return null;
  }

  const onCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(enrollData.secret);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      // Clipboard API may be unavailable (insecure context, permission denied).
      // The secret is still visible — user can copy manually.
    }
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="qr-heading" className="space-y-3">
        <h2 id="qr-heading" className="text-lg font-medium">
          1. Scan with your authenticator
        </h2>
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface-muted p-4 sm:flex-row sm:items-start">
          <img
            src={enrollData.qrDataUrl}
            alt="QR code — scan with your authenticator app"
            width={192}
            height={192}
            className="rounded-md bg-surface p-2"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm text-text-muted">
              Can&apos;t scan? Enter this secret manually:
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-sm bg-surface px-2 py-1 font-mono text-sm">
                {enrollData.secret}
              </code>
              <button
                type="button"
                onClick={onCopySecret}
                className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-text hover:bg-surface-muted"
              >
                {copyState === 'copied' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="recovery-heading" className="space-y-3">
        <h2 id="recovery-heading" className="text-lg font-medium">
          2. Save your recovery codes
        </h2>
        <p className="text-sm text-accent">
          Save these now — they&apos;re shown ONCE; you can&apos;t see them again.
          Use a password manager or print them. Each code works once.
        </p>
        <ul className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface-muted p-3 font-mono text-sm">
          {enrollData.recoveryCodes.map((code) => (
            <li key={code} className="rounded-sm bg-surface px-2 py-1">
              {code}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="verify-heading" className="space-y-3">
        <h2 id="verify-heading" className="text-lg font-medium">
          3. Confirm a code
        </h2>
        <VerifyStep
          credentials={credentials}
          onConfirmed={() => {
            router.replace('/');
            router.refresh();
          }}
          onError={setServerError}
        />
        {serverError && (
          <p
            role="alert"
            className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-text"
          >
            {serverError}
          </p>
        )}
      </section>
    </div>
  );
}

// ---- Step 1: credentials -------------------------------------------------

interface CredentialsStepProps {
  onEnrolled: (creds: AdminTotpEnrollInput, data: EnrollPayload) => void;
}

function CredentialsStep({ onEnrolled }: CredentialsStepProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<AdminTotpEnrollInput>({
    resolver: zodResolver(adminTotpEnrollSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
  });

  useEffect(() => {
    if (errors.email) setFocus('email');
    else if (errors.password) setFocus('password');
  }, [errors.email, errors.password, setFocus]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    let res: Response;
    try {
      res = await fetch('/api/auth/totp/enroll', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
    } catch {
      setServerError('Network error — please try again.');
      return;
    }

    let body: EnrollPayload | ApiErrorBody | null = null;
    try {
      body = (await res.json()) as EnrollPayload | ApiErrorBody;
    } catch {
      body = null;
    }

    if (!res.ok) {
      setServerError(
        (body as ApiErrorBody | null)?.message ??
          'Could not start enrollment. Check your credentials.',
      );
      return;
    }
    onEnrolled(values, body as EnrollPayload);
  });

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5">
      <TextField
        id="enroll-email"
        label="Email"
        type="email"
        autoComplete="username"
        disabled={isSubmitting}
        error={errors.email?.message}
        {...register('email')}
      />
      <TextField
        id="enroll-password"
        label="Password"
        type="password"
        autoComplete="current-password"
        disabled={isSubmitting}
        error={errors.password?.message}
        {...register('password')}
      />
      {serverError && (
        <p
          role="alert"
          className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-text"
        >
          {serverError}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className={cn(
          'w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-text shadow-sm',
          'transition disabled:cursor-not-allowed disabled:opacity-60',
          'hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface',
        )}
      >
        {isSubmitting ? 'Generating secret…' : 'Generate authenticator secret'}
      </button>
    </form>
  );
}

// ---- Step 3: verify ------------------------------------------------------

interface VerifyStepProps {
  credentials: AdminTotpEnrollInput;
  onConfirmed: () => void;
  onError: (message: string) => void;
}

function VerifyStep({ credentials, onConfirmed, onError }: VerifyStepProps) {
  const codeRef = useRef<HTMLInputElement | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<AdminTotpConfirmInput>({
    resolver: zodResolver(adminTotpConfirmSchema),
    defaultValues: { ...credentials, code: '' },
    mode: 'onSubmit',
  });

  useEffect(() => {
    setFocus('code');
  }, [setFocus]);

  useEffect(() => {
    if (errors.code) setFocus('code');
  }, [errors.code, setFocus]);

  const onSubmit = handleSubmit(async (values) => {
    onError('');
    let res: Response;
    try {
      res = await fetch('/api/auth/totp/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
    } catch {
      onError('Network error — please try again.');
      return;
    }

    if (!res.ok) {
      let body: ApiErrorBody | null = null;
      try {
        body = (await res.json()) as ApiErrorBody;
      } catch {
        body = null;
      }
      onError(body?.message ?? 'Could not confirm the code. Try again.');
      return;
    }
    onConfirmed();
  });

  const codeReg = register('code');
  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      <TextField
        id="totp-code"
        label="6-digit code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        disabled={isSubmitting}
        error={errors.code?.message}
        name={codeReg.name}
        onChange={codeReg.onChange}
        onBlur={codeReg.onBlur}
        ref={(el) => {
          codeReg.ref(el);
          codeRef.current = el;
        }}
      />
      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className={cn(
          'w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-text shadow-sm',
          'transition disabled:cursor-not-allowed disabled:opacity-60',
          'hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface',
        )}
      >
        {isSubmitting ? 'Confirming…' : 'Confirm and sign in'}
      </button>
    </form>
  );
}

// ---- Shared field --------------------------------------------------------

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

const TextField = function TextField({
  id,
  label,
  error,
  hint,
  className,
  ref,
  ...props
}: TextFieldProps & { ref?: React.Ref<HTMLInputElement> }) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-text">
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text shadow-sm',
          'placeholder:text-text-muted',
          'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary',
          'disabled:cursor-not-allowed disabled:opacity-60',
          error && 'border-accent focus:border-accent focus:ring-accent',
          className,
        )}
        {...props}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-accent">
          {error}
        </p>
      )}
    </div>
  );
};
