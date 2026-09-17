import type { Metadata } from 'next';
import { EnrollForm } from './enroll-form';

export const metadata: Metadata = {
  title: 'Set up two-factor auth · WeRide Admin',
};

export default function TotpEnrollPage() {
  return (
    <main className="min-h-screen bg-bg text-text antialiased">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Set up two-factor auth</h1>
          <p className="mt-2 text-sm text-text-muted">
            Admin accounts require an authenticator app (Google Authenticator,
            1Password, Authy). Confirm your credentials to generate a secret.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-lg">
          <EnrollForm />
        </div>
      </div>
    </main>
  );
}
