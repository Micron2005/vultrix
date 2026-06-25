"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";

/**
 * A Save button for forms where the trigger lives OUTSIDE the <form> element
 * and is associated to it via the `form="<id>"` attribute (e.g. inline
 * line-item rows in a table, or a sticky bottom action bar). In those layouts
 * the regular `SaveButton` can't be used because `useFormStatus` only reports
 * pending state for a submit button rendered *inside* its form.
 *
 * Instead of relying on native submission, this component reads the referenced
 * form, builds its FormData, and invokes the (bound) server action directly
 * inside a transition — giving us a reliable "Saving… → ✓ Saved" animation
 * that matches `SaveButton` exactly (same `.save-btn` styles + animation).
 *
 * The referenced form should still carry its own `action={serverAction}` so
 * that other submit paths (e.g. pressing Enter inside an input) keep working;
 * this button is `type="button"`, so it never triggers a duplicate native
 * submit.
 */
export function RemoteSaveButton({
  formId,
  action,
  children = "Save",
  className = "",
  size = "md",
  variant = "solid",
  savedLabel = "Saved",
  extraFormData,
}: {
  /** The id of the <form> element this button should submit. */
  formId: string;
  /** Bound server action that accepts the form's FormData. */
  action: (formData: FormData) => void | Promise<void>;
  children?: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
  /** "solid" matches the primary SaveButton; "subtle" suits dense tables. */
  variant?: "solid" | "subtle";
  /** Label shown next to the check on success. */
  savedLabel?: string;
  /** Extra fields to merge into the submitted FormData (e.g. { exit: "1" }). */
  extraFormData?: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleClick() {
    if (typeof document === "undefined") return;
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    // Honour native HTML validation (required fields, maxLength, etc.).
    if (typeof form.reportValidity === "function" && !form.reportValidity()) {
      return;
    }
    const fd = new FormData(form);
    if (extraFormData) {
      for (const [k, v] of Object.entries(extraFormData)) fd.set(k, v);
    }
    startTransition(async () => {
      try {
        await action(fd);
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
      } catch {
        // A server action that redirects throws/navigates here — that's fine,
        // we simply skip the "saved" state since the page is changing.
      }
    });
  }

  const state = pending ? "saving" : saved ? "saved" : "idle";

  const base =
    "save-btn inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 disabled:cursor-wait disabled:opacity-90";
  const sizing = size === "sm" ? "h-8 px-3 text-sm" : "h-9 px-4 text-sm";

  const solidIdle = "bg-zinc-900 text-white hover:bg-zinc-800";
  const subtleIdle =
    "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50";
  const savedStyle = "bg-emerald-600 text-white border-transparent";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      data-state={state}
      className={cn(
        base,
        sizing,
        saved ? savedStyle : variant === "subtle" ? subtleIdle : solidIdle,
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
