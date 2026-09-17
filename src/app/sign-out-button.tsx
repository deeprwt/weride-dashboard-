'use client';

/**
 * SignOutButton — POSTs to /api/auth/logout (which clears cookies) and then
 * navigates to /login. Disables itself while the request is in flight.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@uride/ui-web';

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const onClick = async () => {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Even on network failure we navigate to /login — the user's intent
      // is unambiguous and cookies may already be partially cleared.
    }
    router.replace('/login');
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-busy={pending}
      className={cn(
        'rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text',
        'transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg',
      )}
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
