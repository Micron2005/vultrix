"use client";

export function PrintIntakeButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      data-testid="print-intake-qr"
      className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
    >
      Print
    </button>
  );
}
