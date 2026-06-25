"use client";

import { Printer } from "lucide-react";

/**
 * Small client button that triggers the browser print dialog. Lives on the
 * public marketing flyer page so shop owners can print a hand-out / poster.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 active:bg-zinc-950"
      data-testid="flyer-print-button"
    >
      <Printer className="h-4 w-4" /> Print flyer
    </button>
  );
}
