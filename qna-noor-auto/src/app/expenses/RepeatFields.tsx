"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui";
import { REPEAT_OPTIONS } from "./categories";

function toDateInput(
  d: Date | null | undefined,
  fallbackToday = true,
): string {
  if (d) return new Date(d).toISOString().slice(0, 10);
  return fallbackToday ? new Date().toISOString().slice(0, 10) : "";
}

export function RepeatFields({
  initialInterval = "ONE_TIME",
  initialStartDate,
  initialEndDate,
  initialAutoPost = true,
}: {
  initialInterval?: string;
  initialStartDate?: Date | null;
  initialEndDate?: Date | null;
  initialAutoPost?: boolean;
}) {
  const [interval, setInterval] = useState(initialInterval);
  const repeating = interval !== "ONE_TIME";

  return (
    <div className="grid grid-cols-1 gap-4 border-t border-zinc-200 pt-4 md:grid-cols-4">
      <Field label="Repeats">
        <Select
          name="interval"
          value={interval}
          onChange={(event) => setInterval(event.target.value)}
        >
          {REPEAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Starts">
        <Input
          type="date"
          name="startDate"
          required
          defaultValue={toDateInput(initialStartDate)}
        />
      </Field>
      <Field label="Ends (optional)">
        <Input
          type="date"
          name="endDate"
          defaultValue={toDateInput(initialEndDate, false)}
        />
      </Field>
      <fieldset disabled={!repeating} className={!repeating ? "opacity-50" : ""}>
        <legend className="mb-1 block text-xs font-medium text-zinc-700">
          Posting
        </legend>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="radio"
            name="autoPost"
            value="true"
            defaultChecked={initialAutoPost}
          />
          Post automatically
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="radio"
            name="autoPost"
            value="false"
            defaultChecked={!initialAutoPost}
          />
          Ask me first
        </label>
      </fieldset>
    </div>
  );
}
