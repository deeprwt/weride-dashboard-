'use client';

/**
 * Primary sidebar navigation.
 *
 * A Client Component purely for `usePathname` — the shell around it stays a
 * Server Component, so nothing but the highlight ships to the browser.
 *
 * Sections whose route does not exist yet carry `href: null` and render as
 * inert text. That is not a placeholder for laziness: `typedRoutes` is on, so
 * a <Link> to an unbuilt route fails the build, and a nav item that navigates
 * to a 404 is worse for an operator than one that visibly is not ready.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import { cn } from '@uride/ui-web';

interface NavItem {
  label: string;
  href: Route | null;
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', href: '/' },
  { label: 'Drivers', href: '/drivers' },
  { label: 'Rides', href: '/rides' },
  { label: 'Users', href: null },
  { label: 'Payments', href: null },
  { label: 'Settings', href: null },
];

function isActive(pathname: string, href: Route): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <ul className="space-y-1">
      {NAV_ITEMS.map((item) => (
        <li key={item.label}>
          {item.href === null ? (
            <span
              aria-disabled="true"
              className="block rounded-md px-3 py-2 text-sm text-text-muted/60"
            >
              {item.label}
            </span>
          ) : (
            <Link
              href={item.href}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              className={cn(
                'block rounded-md px-3 py-2 text-sm transition',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isActive(pathname, item.href)
                  ? 'bg-surface-muted font-medium text-text'
                  : 'text-text-muted hover:bg-surface-muted hover:text-text',
              )}
            >
              {item.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
