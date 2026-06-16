"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A textarea that wraps long text and grows to fit its content instead of
 * scrolling a single line out of view. Enter submits the associated form (to
 * match the single-line input it replaces); Shift+Enter inserts a newline.
 */
export function AutoGrowTextarea({
  className,
  onInput,
  onKeyDown,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(resize, []);

  return (
    <textarea
      ref={ref}
      rows={1}
      onInput={(e) => {
        resize();
        onInput?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.form?.requestSubmit();
        }
        onKeyDown?.(e);
      }}
      {...props}
      className={cn(
        "block w-full resize-none overflow-hidden rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900",
        className,
      )}
    />
  );
}
