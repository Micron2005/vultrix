"use client";

import { useRef } from "react";

export function NoteBodyField({
  defaultValue,
}: {
  defaultValue?: string | null;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function insertBullet() {
    const textarea = ref.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const prefix = value.slice(lineStart, start).trim() ? "\n- " : "- ";
    const insertionAt = prefix === "\n- " ? start : lineStart;
    const next = value.slice(0, insertionAt) + prefix + value.slice(insertionAt);
    textarea.value = next;
    const caret = start + prefix.length;
    textarea.focus();
    textarea.setSelectionRange(caret + (end - start), caret + (end - start));
  }

  return (
    <>
      <button
        type="button"
        onClick={insertBullet}
        className="mb-2 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
      >
        • Bullet
      </button>
      <textarea
        ref={ref}
        name="fix"
        rows={10}
        placeholder="Write the details you want to remember."
        defaultValue={defaultValue ?? ""}
        className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
    </>
  );
}
