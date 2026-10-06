"use client";

import { useOptimistic, useTransition } from "react";

type SongTaskRowProps = {
  label: string;
  done: boolean;
  onToggle: (done: boolean) => Promise<void>;
  onRemove: () => Promise<void>;
};

export function SongTaskRow({
  label,
  done,
  onToggle,
  onRemove,
}: SongTaskRowProps) {
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [, startToggleTransition] = useTransition();
  const [removing, startRemoveTransition] = useTransition();

  function toggle() {
    const next = !optimistic;
    startToggleTransition(async () => {
      setOptimistic(next);
      await onToggle(next);
    });
  }

  function remove() {
    startRemoveTransition(async () => {
      await onRemove();
    });
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={optimistic}
        onClick={toggle}
        className="flex min-h-11 w-full min-w-0 flex-1 items-center gap-2 text-left text-sm"
      >
        <span
          aria-hidden="true"
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
            optimistic
              ? "border-[var(--vx-accent-600)] bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)]"
              : "border-zinc-300 bg-white"
          }`}
        >
          {optimistic ? "✓" : null}
        </span>
        <span
          className={
            optimistic
              ? "text-zinc-400 line-through"
              : "text-zinc-700"
          }
        >
          {label}
        </span>
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={removing}
        className="shrink-0 text-xs text-red-600 disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  );
}
