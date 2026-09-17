/**
 * The "nothing here" card.
 *
 * Always says WHY it is empty rather than just that it is: on the KYC queue an
 * empty `Under review` tab and an empty search for "Tremblay" look identical
 * otherwise, and a reviewer reads the first as "no work" and the second as a
 * broken search.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-medium text-text">{title}</p>
      {description && <p className="max-w-md text-sm text-text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
