"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export type NoteListItem = {
  id: string;
  title: string;
  fix: string | null;
  symptom: string | null;
  tags: string | null;
  updatedAt: string;
  yearMin: number | null;
  yearMax: number | null;
  make: string | null;
  model: string | null;
  engine: string | null;
};

export type NoteGroup = { name: string; notes: NoteListItem[] };

export function NotesList({ groups, isAutoShop }: { groups: NoteGroup[]; isAutoShop: boolean }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.name);
        return (
          <Card key={group.name}>
            <button
              type="button"
              onClick={() => setCollapsed((current) => {
                const next = new Set(current);
                if (next.has(group.name)) next.delete(group.name); else next.add(group.name);
                return next;
              })}
              className="flex w-full items-center gap-2 border-b border-zinc-200 px-4 py-3 text-left"
              aria-expanded={!isCollapsed}
            >
              <span className="text-zinc-500" aria-hidden="true">{isCollapsed ? "▸" : "▾"}</span>
              <span className="text-sm font-semibold text-zinc-900">{group.name}</span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">{group.notes.length}</span>
            </button>
            {!isCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Title</th>
                      {isAutoShop && <th className="w-40 px-4 py-2 font-medium">Vehicle</th>}
                      <th className="w-40 px-4 py-2 font-medium">Tags</th>
                      <th className="w-32 px-4 py-2 font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {group.notes.map((note) => (
                      <tr key={note.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-2">
                          <Link href={`/notes/${note.id}`} className="font-medium text-zinc-900 hover:underline">{note.title}</Link>
                          {(isAutoShop ? note.symptom : note.fix) && <div className="line-clamp-1 text-xs text-zinc-500">{isAutoShop ? note.symptom : note.fix}</div>}
                        </td>
                        {isAutoShop && <td className="px-4 py-2 text-xs text-zinc-600">{formatVehicleSpec(note)}</td>}
                        <td className="px-4 py-2 text-xs">
                          {note.tags ? <div className="flex flex-wrap gap-1">{note.tags.split(",").map((tag) => <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700">{tag}</span>)}</div> : <span className="text-zinc-400">—</span>}
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-600">{formatDate(note.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function formatVehicleSpec(note: NoteListItem): string {
  const year = note.yearMin && note.yearMax && note.yearMin !== note.yearMax ? `${note.yearMin}–${note.yearMax}` : note.yearMin ? String(note.yearMin) : note.yearMax ? String(note.yearMax) : "";
  const parts = [year, note.make, note.model].filter(Boolean);
  if (!parts.length) return "Any vehicle";
  const base = parts.join(" ");
  return note.engine ? `${base} · ${note.engine}` : base;
}
