"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Submit button that gives clear visual proof a save happened: while the form
 * action runs it shows "Saving…", then on completion it spins/pops and turns
 * green with "Saved ✓" for about a second before fading back to its idle label.
 *
 * Styled to match the primary `Button` so it's a drop-in replacement for any
 * `<Button type="submit">`. Must be rendered inside the <form> it submits (it
 * reads useFormStatus).
 */
export function SaveButton({
  children = "Save",
  className = "",
  size = "md",
  fullWidth = false,
  savedLabel = "Saved",
}: {
  children?: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
  savedLabel?: string;
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
      // ~0.6s spin/pop animation, then hold the green state ~1s, then reset.
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
      className={cn(
        "save-btn inline-flex items-center justify-center gap-1.5 rounded-md font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 disabled:cursor-wait disabled:opacity-90",
        size === "sm" ? "h-8 px-3 text-sm" : "h-9 px-4 text-sm",
        saved ? "bg-emerald-600" : "bg-zinc-900 hover:bg-zinc-800",
        fullWidth && "w-full",
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
