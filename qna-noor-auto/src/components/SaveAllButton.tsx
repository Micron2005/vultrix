"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import type { RoBulkSavePayload } from "@/app/repair-orders/roBulkSave";

/**
 * Global "Save" for the Repair Order detail page.
 *
 * The page renders the Details block and each line item as SEPARATE forms
 * (line inputs are associated to their form via the `form="<id>"` attribute).
 * A plain submit only ever posts one form, so historically the bottom "Save"
 * button quietly dropped any un-saved line-item edits (e.g. a freshly typed
 * price). This button instead gathers the Details form PLUS every line form in
 * the DOM and persists them all in a single server action.
 *
 * Line forms follow the id convention `labor-<id>`, `part-<id>`, `fee-<id>`;
 * the Details form is `#ro-details-form`.
 */
export function SaveAllButton({
  action,
  children = "Save",
  exit = false,
  variant = "solid",
  className = "",
  savedLabel = "Saved",
}: {
  /** Bound server action: saveRepairOrderAll.bind(null, roId). */
  action: (payload: RoBulkSavePayload) => void | Promise<void>;
  children?: React.ReactNode;
  /** When true, the server action redirects away after saving. */
  exit?: boolean;
  variant?: "solid" | "outline";
  className?: string;
  savedLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function fieldsFrom(form: HTMLFormElement): Record<string, string> {
    const fd = new FormData(form);
    const out: Record<string, string> = {};
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  }

  function collect(prefix: string): { id: string; fields: Record<string, string> }[] {
    const forms = document.querySelectorAll<HTMLFormElement>(`form[id^="${prefix}-"]`);
    const rows: { id: string; fields: Record<string, string> }[] = [];
    forms.forEach((form) => {
      const id = form.id.slice(prefix.length + 1);
      if (!id) return;
      rows.push({ id, fields: fieldsFrom(form) });
    });
    return rows;
  }

  function handleClick() {
    if (typeof document === "undefined") return;

    const detailsForm = document.getElementById("ro-details-form");
    // Honour native validation on the Details form if present.
    if (
      detailsForm instanceof HTMLFormElement &&
      typeof detailsForm.reportValidity === "function" &&
      !detailsForm.reportValidity()
    ) {
      return;
    }

    const payload: RoBulkSavePayload = {
      details:
        detailsForm instanceof HTMLFormElement ? fieldsFrom(detailsForm) : {},
      labor: collect("labor"),
      parts: collect("part"),
      fees: collect("fee"),
      exit,
    };

    startTransition(async () => {
      try {
        await action(payload);
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
      } catch {
        // A redirecting server action (Save & exit) throws/navigates here —
        // that's expected, the page is changing so skip the "saved" flash.
      }
    });
  }

  const base =
    "save-btn inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 disabled:cursor-wait disabled:opacity-90";
  const solidIdle = "bg-zinc-900 text-white hover:bg-zinc-800";
  const outlineIdle =
    "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50";
  const savedStyle = "bg-emerald-600 text-white border-transparent";
  const state = pending ? "saving" : saved ? "saved" : "idle";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      data-state={state}
      data-testid={exit ? "ro-save-and-exit-button" : "ro-save-all-button"}
      className={cn(
        base,
        saved ? savedStyle : variant === "outline" ? outlineIdle : solidIdle,
        className,
      )}
    >
      {saved ? (
        <>
          <span aria-hidden>✓</span> {savedLabel}
        </>
      ) : pending ? (
        "Saving…"
      ) : (
        children
      )}
    </button>
  );
}
