"use client";

import { useState, useTransition } from "react";
import { Button, Input, Select } from "@/components/ui";
import { updateLaborLineTech } from "../actions";

type Tech = { id: string; name: string; initials: string | null };
type Assignment = {
  technicianId: string;
  hours: number | null;
  technician: Tech | null;
};
type AssignmentRow = Assignment & { hoursText: string };

export function TechLineSelect({
  laborLineId,
  repairOrderId,
  lineHours,
  assignments,
  techs,
}: {
  laborLineId: string;
  repairOrderId: string;
  lineHours: number;
  assignments: Assignment[];
  techs: Tech[];
}) {
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<AssignmentRow[]>(
    assignments.length > 0
      ? assignments.map((assignment) => ({
          ...assignment,
          hoursText: assignment.hours == null ? "" : String(assignment.hours),
        }))
      : [{ technicianId: "", hours: lineHours, hoursText: String(lineHours), technician: null }],
  );

  function save(next: AssignmentRow[]) {
    const valid = next
      .filter((assignment) => assignment.technicianId)
      .map(({ technicianId, hoursText }) => ({
        technicianId,
        hours: hoursText.trim() === "" ? null : hoursText,
      }));
    start(() => updateLaborLineTech(laborLineId, repairOrderId, valid));
  }

  function updateRow(index: number, patch: Partial<AssignmentRow>) {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    setRows(next);
    save(next);
  }

  function removeRow(index: number) {
    const next = rows.filter((_, i) => i !== index);
    setRows(next);
    save(next);
  }

  function splitEvenly() {
    const count = rows.filter((row) => row.technicianId).length;
    if (count === 0) return;
    const hours = Math.round((lineHours / count) * 100) / 100;
    const next = rows.map((row) =>
      row.technicianId ? { ...row, hours, hoursText: String(hours) } : row,
    );
    setRows(next);
    save(next);
  }

  return (
    <div className="space-y-1">
      {rows.map((row, index) => {
        const stale =
          row.technicianId &&
          !techs.some((tech) => tech.id === row.technicianId);
        return (
          <div key={`${row.technicianId}-${index}`} className="flex items-center gap-1">
            <Select
              value={row.technicianId}
              disabled={pending}
              onChange={(event) =>
                updateRow(index, {
                  technicianId: event.target.value,
                  technician:
                    techs.find((tech) => tech.id === event.target.value) ?? null,
                })
              }
              className="min-w-36 py-1"
            >
              <option value="">— Select tech —</option>
              {stale && (
                <option value={row.technicianId}>
                  {row.technician?.name ?? "(inactive)"} (inactive)
                </option>
              )}
              {techs.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name}
                </option>
              ))}
            </Select>
            <Input
              value={row.hoursText}
              disabled={pending}
              inputMode="decimal"
              aria-label="Allocated hours"
              onChange={(event) => {
                const hoursText = event.target.value;
                setRows((current) =>
                  current.map((currentRow, i) =>
                    i === index ? { ...currentRow, hoursText } : currentRow,
                  ),
                );
              }}
              onBlur={(event) => {
                const hoursText = event.target.value.trim();
                const next = rows.map((currentRow, i) =>
                  i === index
                    ? {
                        ...currentRow,
                        hoursText: hoursText === "" ? String(lineHours) : hoursText,
                      }
                    : currentRow,
                );
                setRows(next);
                save(next);
              }}
              className="w-16 px-2 py-1 text-right"
            />
            {(rows.length > 1 || row.technicianId) && (
              <button
                type="button"
                disabled={pending}
                onClick={() => removeRow(index)}
                className="px-1 text-zinc-400 hover:text-red-600 disabled:opacity-60"
                aria-label="Remove technician"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            setRows((current) => [
              ...current,
              {
                technicianId: "",
                hours: lineHours,
                hoursText: String(lineHours),
                technician: null,
              },
            ])
          }
          className="px-1 py-0 text-xs"
        >
          + Tech
        </Button>
        {rows.filter((row) => row.technicianId).length > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={splitEvenly}
            className="px-1 py-0 text-xs"
          >
            Split evenly
          </Button>
        )}
      </div>
    </div>
  );
}
