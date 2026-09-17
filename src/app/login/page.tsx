import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in · WeRide Admin',
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-bg text-text antialiased">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">WeRide Admin</h1>
          <p className="mt-2 text-sm text-text-muted">
            Sign in to the operations console.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-lg">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
