"use client";

import { useTransition } from "react";
import { updateLaborLineTech } from "../actions";

type Tech = { id: string; name: string; initials: string | null };

export function TechLineSelect({
  laborLineId,
  repairOrderId,
  currentId,
  currentName,
  techs,
}: {
  laborLineId: string;
  repairOrderId: string;
  currentId: string | null;
  currentName: string | null;
  techs: Tech[];
}) {
  const [pending, start] = useTransition();

  const valueIsStale = currentId && !techs.some((t) => t.id === currentId);

  return (
    <select
      defaultValue={currentId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value || null;
        start(() => {
          updateLaborLineTech(laborLineId, repairOrderId, v);
        });
      }}
      className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
    >
      <option value="">— Unassigned —</option>
      {valueIsStale && currentId && (
        <option value={currentId}>
          {currentName ?? "(inactive)"} (inactive)
        </option>
      )}
      {techs.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
