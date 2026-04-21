"use client";

import { PARTS_SUPPLIERS, type SupplierLookup } from "@/lib/partsSuppliers";

type Props = {
  ctx: SupplierLookup;
  /** Compact variant used inline in table rows. */
  compact?: boolean;
  /** Optional label shown above the row of buttons (desktop only). */
  label?: string;
};

/**
 * Renders a row of supplier deep-link buttons. Each button opens the
 * supplier's own search page in a new tab with the part / vehicle
 * context prefilled. No API calls — the user stays signed into each
 * supplier in their browser as normal.
 */
export function SupplierLinks({ ctx, compact = false, label }: Props) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {PARTS_SUPPLIERS.map((s) => (
          <a
            key={s.id}
            href={s.buildUrl(ctx)}
            target="_blank"
            rel="noopener noreferrer"
            title={s.description}
            className="inline-flex items-center rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-700 hover:border-zinc-500 hover:text-zinc-900"
          >
            {s.short}
          </a>
        ))}
      </div>
    );
  }
  return (
    <div>
      {label && (
        <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
          {label}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {PARTS_SUPPLIERS.map((s) => (
          <a
            key={s.id}
            href={s.buildUrl(ctx)}
            target="_blank"
            rel="noopener noreferrer"
            title={s.description}
            className="inline-flex items-center rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:border-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
          >
            {s.name}
            <span aria-hidden className="ml-1 text-zinc-400">↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}
