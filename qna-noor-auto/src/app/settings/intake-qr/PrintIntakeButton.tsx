"use client";

export function PrintIntakeButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      data-testid="print-intake-qr"
      className="inline-flex items-center justify-center rounded-md bg-[var(--vx-accent-600)] px-4 py-2 text-sm font-medium text-[var(--vx-accent-fg)] hover:bg-[var(--vx-accent-700)]"
    >
      Print
    </button>
  );
}
