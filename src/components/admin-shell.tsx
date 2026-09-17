/**
 * The admin chrome: sidebar, header, content well.
 *
 * A Server Component so the signed-in operator's email is resolved on the
 * server with the httpOnly cookie and never round-trips through the browser.
 * A failed /v1/me does NOT fail the page: a reviewer with twelve applications
 * waiting should not lose the queue because a decorative header field could
 * not be fetched. An expired session is different — that redirects to /login,
 * because every child of this shell is about to fail the same way.
 */
import { redirect } from 'next/navigation';
import { ApiError } from '@uride/api-client';
import { apiServerFetch } from '@/lib/api-server';
import { SignOutButton } from '@/app/sign-out-button';
import { SidebarNav } from './sidebar-nav';

interface ShellUser {
  email: string | null;
}

export async function AdminShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  let email: string | null = null;
  try {
    const me = await apiServerFetch<ShellUser>('/v1/me');
    email = me.email;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect('/login');
    }
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
          <h1 className="text-base font-semibold tracking-tight">{title}</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted">{email ?? 'unknown'}</span>
            <SignOutButton />
          </div>
        </header>

        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
