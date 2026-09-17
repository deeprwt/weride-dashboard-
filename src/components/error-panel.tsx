/**
 * The failed-fetch card for Server Components.
 *
 * Renders the upstream message verbatim. These are operator-facing screens and
 * the API's errors are written for operators — swapping "This driver cannot be
 * approved yet: insurance is still pending" for "Something went wrong" costs
 * the reviewer the one sentence that tells them what to do next.
 */
export function ErrorPanel({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-danger-500/40 bg-surface p-6 shadow-sm"
    >
      <h2 className="text-base font-semibold text-text">{title}</h2>
      <p className="mt-2 text-sm text-text-muted">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
