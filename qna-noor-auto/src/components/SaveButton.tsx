"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button that gives clear visual proof a save happened: while the form
 * action runs it shows "Saving…", then on completion it spins/pops and turns
 * green with "Saved ✓" for a moment before returning to its idle label.
 *
 * Must be rendered inside the <form> it submits (it reads useFormStatus).
 */
export function SaveButton({
  children = "Save",
  className = "",
  fullWidth = false,
}: {
  children?: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }
    if (wasPending.current) {
      wasPending.current = false;
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 1600);
      return () => clearTimeout(t);
    }
  }, [pending]);

  const state = pending ? "saving" : saved ? "saved" : "idle";

  return (
    <button
      type="submit"
      disabled={pending}
      data-state={state}
      className={`save-btn inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-wait disabled:opacity-90 ${
        saved ? "bg-emerald-600" : "bg-zinc-900 hover:bg-zinc-800"
      } ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {saved ? (
        <>
          <span aria-hidden>✓</span> Saved
        </>
      ) : pending ? (
        "Saving…"
      ) : (
        children
      )}
    </button>
  );
}
