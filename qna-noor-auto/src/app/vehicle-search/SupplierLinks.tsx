"use client";

import { useState } from "react";
import {
  PARTS_SUPPLIERS,
  formatSupplierClipboard,
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
 * or part number. Suppliers that have their own vehicle selector
 * (AutoZone Pro, O'Reilly First Call) don't accept a vehicle URL
 * parameter, so we copy the VIN (or plate) to the clipboard and append
 * it as a URL fragment that the optional QNA Chrome extension can read
 * to auto-fill their Add Vehicle dialog.
 */
export function SupplierLinks({ ctx, compact = false, label }: Props) {
  const [copied, setCopied] = useState<{ id: string; hint: string } | null>(
    null,
  );
  const clip = formatSupplierClipboard(ctx);
  const anyNeedsVehicle = PARTS_SUPPLIERS.some((s) => s.needsVehicleContext);

  function openSupplier(s: SupplierDef) {
    let url = s.buildUrl(ctx);
    // For suppliers whose vehicle is session-scoped (AutoZone Pro,
    // First Call), append a #qna-vin=... / #qna-plate=... fragment. If
    // the QNA Chrome extension is installed it reads that fragment and
    // auto-fills their Add Vehicle dialog; otherwise it's a harmless
    // no-op and the clipboard fallback below still works.
    if (s.needsVehicleContext && clip) {
      const hashParams = new URLSearchParams();
      if (clip.kind === "vin") {
        hashParams.set("qna-vin", clip.text);
      } else if (clip.kind === "plate") {
        hashParams.set("qna-plate", clip.text);
        if (ctx.licenseState)
          hashParams.set("qna-state", ctx.licenseState.toUpperCase());
      }
      const hashStr = hashParams.toString();
      if (hashStr) url += (url.includes("#") ? "&" : "#") + hashStr;
    }
    // Open the tab synchronously first: awaiting the clipboard write
    // consumes the transient user-activation token in Firefox/Safari, so
    // a later window.open would be treated as a popup and silently blocked.
    window.open(url, "_blank", "noopener,noreferrer");
    if (s.needsVehicleContext && clip) {
      void navigator.clipboard
        ?.writeText(clip.text)
        .then(() => {
          setCopied({ id: s.id, hint: clip.hint });
          window.setTimeout(
            () => setCopied((prev) => (prev?.id === s.id ? null : prev)),
            6000,
          );
        })
        .catch(() => {
          // Clipboard unavailable (HTTP, older Safari, etc.) — the tab is
          // already open, the user just won't get the auto-copy.
        });
    }
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
              {copied?.id === s.id && (
                <span className="ml-1.5 text-emerald-600">✓ copied</span>
              )}
            </button>
          );
        })}
      </div>
      {!compact && copied && (
        <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">
          {copied.hint}
        </div>
      )}
      {!compact && !copied && clip && anyNeedsVehicle && (
        <div className="mt-1.5 text-xs text-zinc-500">
          {clip.kind === "vin" && (
            <>
              Clicking AutoZone or O&apos;Reilly auto-copies the{" "}
              <span className="font-medium text-zinc-700">VIN</span> so you can
              paste it into their &ldquo;Add Vehicle → VIN&rdquo; dialog. If
              you install the optional QNA browser extension, the VIN fills
              automatically.
            </>
          )}
          {clip.kind === "plate" && (
            <>
              No VIN on file — clicking AutoZone or O&apos;Reilly auto-copies
              the <span className="font-medium text-zinc-700">plate</span> for
              their &ldquo;Add Vehicle → License Plate&rdquo; dialog.
            </>
          )}
          {clip.kind === "ymm" && (
            <>
              No VIN or plate on file — clicking AutoZone or O&apos;Reilly
              auto-copies{" "}
              <span className="font-medium text-zinc-700">{clip.text}</span>{" "}
              so you can pick year/make/model manually.
            </>
          )}
        </div>
      )}
    </div>
  );
}
