/**
 * Inline preview of a KYC document.
 *
 * Every source here points at the dashboard's own /api/admin/drivers proxy,
 * never at the core API: the bytes are passports and driving licences, and the
 * only credential that should be able to fetch them is the httpOnly cookie the
 * browser attaches to a same-origin request on its own.
 *
 * next/image is deliberately not used. Its optimiser would fetch the file
 * itself — without the operator's session — and write a resized copy of a
 * government ID into the server's image cache, where nothing in our retention
 * policy would ever go looking for it.
 */
import type { DriverDocument } from '@uride/types';
import { documentTypeLabel } from './format';

export function documentFileHref(doc: DriverDocument): string {
  return `/api/admin/drivers/${doc.driverId}/documents/${doc.id}/file`;
}

/** `document` is destructured away immediately — the DOM global of that name has no place here. */
export function DocumentPreview({ document: doc }: { document: DriverDocument }) {
  const href = documentFileHref(doc);
  const label = documentTypeLabel(doc.type);

  if (doc.mimeType.startsWith('image/')) {
    return (
      <figure className="overflow-hidden rounded-lg border border-border bg-surface-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={href}
          alt={`${label} — ${doc.fileName}`}
          loading="lazy"
          className="mx-auto max-h-[26rem] w-full object-contain"
        />
        <figcaption className="border-t border-border bg-surface px-3 py-2 text-xs text-text-muted">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Open full size
          </a>
        </figcaption>
      </figure>
    );
  }

  if (doc.mimeType === 'application/pdf') {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-surface-muted">
        <object
          data={href}
          type="application/pdf"
          aria-label={`${label} — ${doc.fileName}`}
          className="h-[26rem] w-full"
        >
          {/* Rendered by browsers with no built-in PDF viewer, and by the ones
              that refuse to embed one in an <object>. */}
          <p className="p-4 text-sm text-text-muted">
            This browser cannot display the PDF inline.{' '}
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-text"
            >
              Open it in a new tab
            </a>
            .
          </p>
        </object>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-text-muted">
      No inline preview for {doc.mimeType}.{' '}
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Open the file
      </a>
      .
    </div>
  );
}
