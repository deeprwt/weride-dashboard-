'use client';

/**
 * The board's heartbeat.
 *
 * The rides page is a Server Component, which is the right call — no ride data
 * goes anywhere near a client store — but a dispatch board that only updates
 * when somebody presses F5 is not a live board. This is the smallest thing that
 * fixes that: a timer that calls `router.refresh()`, which re-runs the server
 * render and streams the new HTML in. Nothing here fetches or holds ride data.
 *
 * Three deliberate behaviours:
 *
 *  - **Pausable.** An operator reading a row does not want it to move under
 *    their cursor mid-sentence, and the control is a real button so it can be
 *    reached and toggled from the keyboard.
 *  - **Stops when the tab is hidden.** A console left open on a spare monitor
 *    for a week would otherwise poll the API a quarter of a million times for
 *    nobody. The first refresh on return is immediate, so coming back to the
 *    tab never shows a stale board.
 *  - **No clock in the initial render.** The "updated at" stamp starts null and
 *    is only ever set in an effect: rendering `new Date()` during the first
 *    render is a hydration mismatch by construction, because the server and the
 *    browser cannot agree on what time it is.
 */
import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@uride/ui-web';

const TIME_FORMAT = new Intl.DateTimeFormat('en-CA', { timeStyle: 'medium' });

export function AutoRefresh({ seconds = 8 }: { seconds?: number }) {
  const router = useRouter();
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isRefreshing, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
      setUpdatedAt(TIME_FORMAT.format(new Date()));
    });
  }, [router]);

  useEffect(() => {
    if (!live) return;

    const tick = () => {
      // document.hidden rather than a visibilitychange-only listener: a tab that
      // was hidden when the interval fired must simply skip that tick, not
      // queue up a burst of refreshes for when it comes back.
      if (!document.hidden) refresh();
    };
    const timer = window.setInterval(tick, seconds * 1000);

    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [live, seconds, refresh]);

  return (
    <div className="flex items-center gap-3 text-xs text-text-muted">
      <span aria-live="polite" className="tabular-nums">
        {updatedAt ? `Updated ${updatedAt}` : 'Live board'}
      </span>
      <button
        type="button"
        onClick={() => setLive((on) => !on)}
        aria-pressed={live}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          live
            ? 'border-success-500/40 bg-success-500/10 text-success-700 dark:text-success-500'
            : 'border-border bg-surface text-text-muted hover:bg-surface-muted hover:text-text',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            live ? 'animate-pulse bg-success-600' : 'bg-text-muted/60',
          )}
        />
        {live ? `Auto-refresh ${seconds}s` : 'Paused'}
      </button>
      <button
        type="button"
        onClick={refresh}
        disabled={isRefreshing}
        className="rounded-md border border-border bg-surface px-2.5 py-1 font-medium text-text transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {isRefreshing ? 'Refreshing…' : 'Refresh now'}
      </button>
    </div>
  );
}
