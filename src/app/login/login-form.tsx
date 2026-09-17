'use client';

/**
 * LoginForm — email + password (and TOTP when the API asks for it).
 *
 * Submission flow:
 *   1. POST /api/auth/login with { email, password }
 *      - 200 { kind: 'tokens', user }       -> router.replace('/')
 *      - 200 { kind: 'totp_required' }      -> reveal TOTP input, resubmit
 *      - 200 { kind: 'totp_enrollment_required' } -> router.replace('/login/totp/enroll')
 *      - 4xx -> surface the error message inline
 *   2. With TOTP visible, the same submission carries `totp` and follows the
 *      same response handling.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { adminLoginSchema, type AdminLoginInput } from '@uride/validation';
import { cn } from '@uride/ui-web';

type LoginStage = 'credentials' | 'totp';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

type LoginResponse =
  | { kind: 'tokens'; user: { id: string; email: string; roles: string[] } }
  | { kind: 'totp_required' }
  | { kind: 'totp_enrollment_required' };

export function LoginForm() {
  const router = useRouter();
  const [stage, setStage] = useState<LoginStage>('credentials');
  const [serverError, setServerError] = useState<string | null>(null);
  const totpRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<AdminLoginInput>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: '', password: '', totp: '' },
    mode: 'onSubmit',
  });

  // Focus the TOTP input as soon as we enter the totp stage.
  useEffect(() => {
    if (stage === 'totp') {
      totpRef.current?.focus();
    }
  }, [stage]);

  // Move keyboard focus to the first error after a failed validation.
  useEffect(() => {
    if (errors.email) setFocus('email');
    else if (errors.password) setFocus('password');
    else if (errors.totp) setFocus('totp');
  }, [errors.email, errors.password, errors.totp, setFocus]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    // Don't send an empty totp string — the server schema treats it as a real value.
    const payload: AdminLoginInput = values.totp
      ? values
      : { email: values.email, password: values.password };

    let res: Response;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      setServerError('Network error — please try again.');
      return;
    }

    let body: LoginResponse | ApiErrorBody | null = null;
    try {
      body = (await res.json()) as LoginResponse | ApiErrorBody;
    } catch {
      body = null;
    }

    if (!res.ok) {
      const message =
        (body as ApiErrorBody | null)?.message ??
        'Sign-in failed. Check your credentials and try again.';
      setServerError(message);
      return;
    }

    const result = body as LoginResponse;
    if (result.kind === 'tokens') {
      router.replace('/');
      router.refresh();
      return;
    }
    if (result.kind === 'totp_required') {
      setStage('totp');
      return;
    }
    if (result.kind === 'totp_enrollment_required') {
      router.replace('/login/totp/enroll');
      return;
    }
    setServerError('Unexpected response from server.');
  });

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5">
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="username"
        disabled={isSubmitting || stage === 'totp'}
        error={errors.email?.message}
        {...register('email')}
      />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        disabled={isSubmitting || stage === 'totp'}
        error={errors.password?.message}
        {...register('password')}
      />

      {stage === 'totp' && (() => {
        const totpReg = register('totp');
        return (
          <Field
            id="totp"
            label="Authenticator code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={12}
            disabled={isSubmitting}
            error={errors.totp?.message}
            hint="6-digit code from your authenticator app, or a recovery code."
            name={totpReg.name}
            onChange={totpReg.onChange}
            onBlur={totpReg.onBlur}
            ref={(el) => {
              totpReg.ref(el);
              totpRef.current = el;
            }}
          />
        );
      })()}

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
        {isSubmitting ? 'Signing in…' : stage === 'totp' ? 'Verify code' : 'Sign in'}
      </button>
    </form>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

const Field = function Field({
  id,
  label,
  error,
  hint,
  className,
  ref,
  ...props
}: FieldProps & { ref?: React.Ref<HTMLInputElement> }) {
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
