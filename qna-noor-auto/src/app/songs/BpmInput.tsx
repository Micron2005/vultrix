"use client";

import { useState } from "react";
import { Input } from "@/components/ui";

export function BpmInput({
  value,
  min,
  max,
  onCommit,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (bpm: number) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }

  function commit() {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = Math.min(max, Math.max(min, parsed));
    setDraft(String(next));
    if (next !== value) onCommit(next);
  }

  return (
    <Input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
