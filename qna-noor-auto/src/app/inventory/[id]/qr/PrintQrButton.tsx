"use client";

export function PrintQrButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800"
    >
      Print sticker
    </button>
  );
}
