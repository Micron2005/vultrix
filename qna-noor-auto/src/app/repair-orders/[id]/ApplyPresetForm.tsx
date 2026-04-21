"use client";

import { useState } from "react";
import { Button, Select } from "@/components/ui";

type Preset = {
  id: string;
  name: string;
  category: string | null;
  laborCount: number;
  partCount: number;
};

export function ApplyPresetForm({
  action,
  presets,
}: {
  action: (fd: FormData) => void;
  presets: Preset[];
}) {
  const [jobId, setJobId] = useState("");

  if (presets.length === 0) {
    return (
      <div className="text-sm text-zinc-500">
        No active presets.{" "}
        <a
          href="/canned-jobs/new"
          className="text-zinc-900 underline hover:no-underline"
        >
          Create one →
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="flex items-end gap-2">
      <div className="flex-1">
        <Select
          name="jobId"
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          required
        >
          <option value="">Pick a preset…</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.category ? `[${p.category}] ` : ""}
              {p.name} · {p.laborCount} labor · {p.partCount} parts
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="secondary" disabled={!jobId}>
        Apply preset
      </Button>
    </form>
  );
}
