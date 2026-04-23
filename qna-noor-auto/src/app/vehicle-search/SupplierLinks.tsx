"use client";

import { useState } from "react";
import {
  PARTS_SUPPLIERS,
  formatVehicleHint,
  type SupplierDef,
  type SupplierLookup,
} from "@/lib/partsSuppliers";

type Props = {
  ctx: SupplierLookup;
  /** Compact variant used inline in table rows. */
  compact?: boolean;
  /** Optional label shown above the row of buttons (desktop only). */
  label?: string;
};

/**
 * Renders a row of supplier deep-link buttons. Each button opens the
 * supplier's own search page in a new tab prefilled with the part name
 * or part number. Suppliers that have their own vehicle selector (AutoZone
 * Pro, O'Reilly First Call) don't accept a vehicle URL parameter, so we
 * copy the year / make / model string to the clipboard on click — paste
 * into the supplier's own vehicle picker after the tab opens.
 */
export function SupplierLinks({ ctx, compact = false, label }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const vehicleHint = formatVehicleHint(ctx);

  async function openSupplier(s: SupplierDef) {
    const url = s.buildUrl(ctx);
    if (s.needsVehicleContext && vehicleHint) {
      try {
        await navigator.clipboard.writeText(vehicleHint);
        setCopied(s.id);
        window.setTimeout(() => setCopied((prev) => (prev === s.id ? null : prev)), 4000);
      } catch {
        // Clipboard unavailable (HTTP, older Safari, etc.) — fall through
        // and still open the tab; the user just won't get the auto-copy.
      }
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const btnClass = compact
    ? "inline-flex items-center rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-700 hover:border-zinc-500 hover:text-zinc-900"
    : "inline-flex items-center rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:border-zinc-500 hover:text-zinc-900 hover:bg-zinc-50";

  return (
    <div>
      {!compact && label && (
        <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
          {label}
        </div>
      )}
      <div className={compact ? "flex flex-wrap gap-1" : "flex flex-wrap gap-2"}>
        {PARTS_SUPPLIERS.map((s) => {
          const showArrow = !compact;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => openSupplier(s)}
              title={s.description}
              className={btnClass}
            >
              {compact ? s.short : s.name}
              {showArrow && (
                <span aria-hidden className="ml-1 text-zinc-400">
                  ↗
                </span>
              )}
              {copied === s.id && (
                <span className="ml-1.5 text-emerald-600">✓ vehicle copied</span>
              )}
            </button>
          );
        })}
      </div>
      {!compact && vehicleHint && (
        <div className="mt-1.5 text-xs text-zinc-500">
          Vehicle context:{" "}
          <span className="font-medium text-zinc-700">{vehicleHint}</span>
          {" "}— clicking AutoZone or O&apos;Reilly auto-copies this; paste into
          the supplier&apos;s &ldquo;My Zone&rdquo; / vehicle selector to filter results.
        </div>
      )}
    </div>
  );
}
