"use client";

import { useState } from "react";
import { Button, Select } from "@/components/ui";

type Tech = { id: string; name: string; initials: string | null };

export function LaborTechPicker({ techs }: { techs: Tech[] }) {
  const [rows, setRows] = useState<string[]>([""]);

  return (
    <div className="space-y-1">
      {rows.map((value, index) => (
        <div key={index} className="flex items-center gap-1">
          <Select
            name="technicianId[]"
            value={value}
            onChange={(event) =>
              setRows((current) =>
                current.map((row, i) =>
                  i === index ? event.target.value : row,
                ),
              )
            }
            className="min-w-36 py-1"
          >
            <option value="">— None —</option>
            {techs.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name}
              </option>
            ))}
          </Select>
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setRows((current) => current.filter((_, i) => i !== index))
              }
              className="px-1 text-zinc-400 hover:text-red-600"
              aria-label="Remove technician"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setRows((current) => [...current, ""])}
        className="px-1 py-0 text-xs"
      >
        + Tech
      </Button>
    </div>
  );
}
