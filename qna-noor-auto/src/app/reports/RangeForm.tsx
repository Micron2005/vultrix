"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

type Preset = "30d" | "mtd" | "ytd" | "12m" | "custom";

const presets: { value: Preset; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "mtd", label: "This month" },
  { value: "ytd", label: "This year" },
  { value: "12m", label: "Last 12 months" },
  { value: "custom", label: "Custom" },
];

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function RangeForm({
  preset,
  from,
  to,
}: {
  preset: Preset;
  from: Date;
  to: Date;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [current, setCurrent] = useState<Preset>(preset);
  const [fromStr, setFromStr] = useState(toInputDate(from));
  const [toStr, setToStr] = useState(toInputDate(to));

  function applyPreset(p: Preset) {
    setCurrent(p);
    if (p === "custom") return;
    const params = new URLSearchParams(sp);
    params.set("preset", p);
    params.delete("from");
    params.delete("to");
    router.push(`/reports?${params.toString()}`);
  }

  function onCustom(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("preset", "custom");
    params.set("from", fromStr);
    params.set("to", toStr);
    router.push(`/reports?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => applyPreset(p.value)}
            className={
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors " +
              (current === p.value
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50")
            }
          >
            {p.label}
          </button>
        ))}
      </div>
      {current === "custom" && (
        <form onSubmit={onCustom} className="flex items-center gap-2">
          <input
            type="date"
            value={fromStr}
            onChange={(e) => setFromStr(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
            aria-label="From date"
          />
          <span className="text-xs text-zinc-500">to</span>
          <input
            type="date"
            value={toStr}
            onChange={(e) => setToStr(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
            aria-label="To date"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800"
          >
            Apply
          </button>
        </form>
      )}
    </div>
  );
}
