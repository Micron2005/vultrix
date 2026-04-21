"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => {
        if (typeof window !== "undefined") window.print();
      }}
      className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-3 h-9 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
    >
      Print reminder card
    </button>
  );
}
