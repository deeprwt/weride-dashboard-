/**
 * Protected admin home.
 *
 * Server Component — fetches `/v1/me` server-side using the bearer token from
 * the httpOnly cookie. On 401-after-refresh the helper clears the cookies; we
 * then redirect to /login. Successful responses render the Phase 1 admin shell.
 */
import { redirect } from 'next/navigation';
import { ApiError } from '@uride/api-client';
import { TokenProof } from '@uride/ui-web';
import { apiServerFetch } from '@/lib/api-server';
import { SidebarNav } from '@/components/sidebar-nav';
import { SignOutButton } from './sign-out-button';

interface MeResponse {
  id: string;
  email: string | null;
  fullName: string | null;
  roles: string[];
  lastLoginAt: string | null;
}

export default async function AdminHomePage() {
  let me: MeResponse;
  try {
    me = await apiServerFetch<MeResponse>('/v1/me');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect('/login');
    }
    // Any other failure: surface a minimal error UI rather than swallowing.
    const message = err instanceof Error ? err.message : 'Unknown error';
    return (
      <main className="min-h-screen bg-bg p-8 text-text">
        <div className="mx-auto max-w-2xl rounded-lg border border-border bg-surface p-6">
          <h1 className="text-lg font-semibold">Unable to load admin profile</h1>
          <p className="mt-2 text-sm text-text-muted">{message}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg text-text">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-surface md:flex md:flex-col">
        <div className="flex h-14 items-center border-b border-border px-4">
          <span className="text-sm font-semibold tracking-tight">WeRide Admin</span>
        </div>
        <nav aria-label="Primary" className="flex-1 px-2 py-4">
          <SidebarNav />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4">
          <h1 className="text-base font-semibold tracking-tight">WeRide Operations</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted">{me.email ?? 'unknown'}</span>
            <SignOutButton />
          </div>
        </header>

        <main className="flex-1 px-6 py-8">
          <div className="mx-auto max-w-4xl space-y-8">
            <section
              aria-labelledby="profile-heading"
              className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
            >
              <h2 id="profile-heading" className="text-lg font-semibold">
                Signed in
              </h2>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-text-muted">Email</dt>
                  <dd className="mt-1 font-medium">{me.email ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">User ID</dt>
                  <dd className="mt-1 font-mono text-xs">{me.id}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-text-muted">Roles</dt>
                  <dd className="mt-1 flex flex-wrap gap-2">
                    {me.roles.length === 0 ? (
                      <span className="text-text-muted">No roles assigned</span>
                    ) : (
                      me.roles.map((role) => (
                        <span
                          key={role}
                          className="inline-flex rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-text"
                        >
                          {role}
                        </span>
                      ))
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            <section
              aria-labelledby="tokens-heading"
              className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
            >
              <h2 id="tokens-heading" className="text-lg font-semibold">
                Design system check
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                Verifies the @uride/ui-tokens pipeline reaches this app.
              </p>
              <div className="mt-4 overflow-hidden rounded-lg border border-border">
                <TokenProof surface="Admin" />
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
