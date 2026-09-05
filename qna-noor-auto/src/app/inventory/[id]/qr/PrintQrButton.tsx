"use client";

export function PrintQrButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)] hover:bg-[var(--vx-accent-700)]"
    >
      Print sticker
    </button>
  );
}
