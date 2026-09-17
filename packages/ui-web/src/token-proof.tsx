import * as React from 'react';
import { cn } from './cn';

/**
 * TokenProof — Phase 0 sanity check that @uride/ui-tokens reaches the web apps
 * through @uride/config/tailwind/preset. Rendered on the placeholder pages of
 * admin-web and marketing-web; remove once real components land.
 */
export function TokenProof({ surface }: { surface: string }) {
  return (
    <main className="min-h-screen bg-bg text-text antialiased">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-lg">
          <span className="inline-flex rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-text">
            Phase 0
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">WeRide · {surface}</h1>
          <p className="mt-2 text-text-muted">
            Design tokens piped end-to-end. If this page is brand-teal and crisp, the token
            pipeline (
            <code className={cn('rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-sm')}>
              @uride/ui-tokens
            </code>{' '}
            → Tailwind preset → app) works.
          </p>
          <div className="mt-8 grid grid-cols-5 gap-2">
            {[100, 300, 500, 700, 900].map((shade) => (
              <div
                key={shade}
                className={`h-10 rounded-md bg-brand-${shade}`}
                title={`brand-${shade}`}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
