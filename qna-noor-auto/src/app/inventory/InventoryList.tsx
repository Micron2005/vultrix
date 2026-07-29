"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { bulkUpdatePartFields } from "./actions";
import { Button, Card, Input } from "@/components/ui";

const COMMON_UNITS = [
  "each",
  "set",
  "pair",
  "qt",
  "L",
  "gal",
  "oz",
  "ml",
  "can",
  "bottle",
  "ft",
];

export type InventoryPart = {
  id: string;
  name: string;
  description: string | null;
  partNumber: string | null;
  source: string | null;
  location: string | null;
  unit: string | null;
  category: string | null;
  costPrice: number | null;
  unitPrice: number | null;
  qtyOnHand: number;
  reorderLevel: number;
};

type InventoryGroup = [string, InventoryPart[]];

function stockStatus(qty: number, reorder: number): {
  label: string;
  className: string;
} {
  if (qty <= 0) {
    return {
      label: "Out of stock",
      className: "bg-red-100 text-red-800",
    };
  }
  if (qty <= reorder) {
    return {
      label: "Low",
      className: "bg-amber-100 text-amber-800",
    };
  }
  return {
    label: "In stock",
    className: "bg-emerald-100 text-emerald-800",
  };
}

export function InventoryList({
  groups,
  allCategories,
  allLocations,
  allUnits,
  partCount,
}: {
  groups: InventoryGroup[];
  allCategories: string[];
  allLocations: string[];
  allUnits: string[];
  partCount: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [unit, setUnit] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(groupName: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }

  function toggleGroupSelection(groupParts: InventoryPart[]) {
    setSelected((current) => {
      const next = new Set(current);
      const allSelected = groupParts.every((part) => next.has(part.id));
      for (const part of groupParts) {
        if (allSelected) next.delete(part.id);
        else next.add(part.id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setCategory("");
    setLocation("");
    setUnit("");
  }

  function applyBulkUpdate() {
    const fields: {
      category?: string;
      location?: string;
      unit?: string;
    } = {};
    if (category.trim()) fields.category = category.trim();
    if (location.trim()) fields.location = location.trim();
    if (unit.trim()) fields.unit = unit.trim();
    if (Object.keys(fields).length === 0) return;

    startTransition(async () => {
      await bulkUpdatePartFields([...selected], fields);
      clearSelection();
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-2 text-sm text-zinc-500">
        {partCount} part{partCount === 1 ? "" : "s"}
      </div>
      <div className="space-y-4">
        {groups.map(([groupName, groupParts]) => {
          const isCollapsed = collapsed.has(groupName);
          const groupIds = groupParts.map((part) => part.id);
          const groupSelected = groupIds.every((id) => selected.has(id));
          return (
            <GroupRows
              key={groupName}
              groupName={groupName}
              groupParts={groupParts}
              isCollapsed={isCollapsed}
              groupSelected={groupSelected}
              onToggle={() => toggleGroup(groupName)}
              onToggleSelection={() => toggleGroupSelection(groupParts)}
              selected={selected}
              onToggleSelected={toggleSelected}
            />
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-20 flex w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 flex-wrap items-end gap-3 rounded-lg border border-zinc-300 bg-white p-3 shadow-lg">
          <div className="mr-auto">
            <div className="text-sm font-semibold text-zinc-900">{selected.size} selected</div>
            <div className="text-xs text-zinc-500">Fill in any fields to apply to all selected parts.</div>
          </div>
          <label className="text-xs font-medium text-zinc-600">
            Category
            <Input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              list="bulk-category-options"
              placeholder="Category"
              className="mt-1 w-36"
            />
          </label>
          <datalist id="bulk-category-options">
            {allCategories.map((option) => <option key={option} value={option} />)}
          </datalist>
          <label className="text-xs font-medium text-zinc-600">
            Location
            <Input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              list="bulk-location-options"
              placeholder="Location / bin"
              className="mt-1 w-36"
            />
          </label>
          <datalist id="bulk-location-options">
            {allLocations.map((option) => <option key={option} value={option} />)}
          </datalist>
          <label className="text-xs font-medium text-zinc-600">
            Unit
            <Input
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              list="bulk-unit-options"
              placeholder="Unit"
              className="mt-1 w-28"
            />
          </label>
          <datalist id="bulk-unit-options">
            {[...new Set([...COMMON_UNITS, ...allUnits])].map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <Button type="button" size="sm" disabled={isPending || Object.values({ category, location, unit }).every((value) => !value.trim())} onClick={applyBulkUpdate}>
            {isPending ? "Applying…" : "Apply"}
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={isPending} onClick={clearSelection}>
            Clear selection
          </Button>
        </div>
      )}
    </>
  );
}

function GroupRows({
  groupName,
  groupParts,
  isCollapsed,
  groupSelected,
  onToggle,
  onToggleSelection,
  selected,
  onToggleSelected,
}: {
  groupName: string;
  groupParts: InventoryPart[];
  isCollapsed: boolean;
  groupSelected: boolean;
  onToggle: () => void;
  onToggleSelection: () => void;
  selected: Set<string>;
  onToggleSelected: (id: string) => void;
}) {
  const groupCheckbox = useRef<HTMLInputElement>(null);
  const someSelected = groupParts.some((part) => selected.has(part.id)) && !groupSelected;

  useEffect(() => {
    if (groupCheckbox.current) groupCheckbox.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <Card>
      <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center">
          <input
            ref={groupCheckbox}
            type="checkbox"
            aria-label={`Select all ${groupName} parts`}
            checked={groupSelected}
            onChange={onToggleSelection}
            className="h-4 w-4 rounded border-zinc-300"
          />
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!isCollapsed}
        >
          <span aria-hidden="true" className="text-zinc-500">
            {isCollapsed ? "▸" : "▾"}
          </span>
          <span className="truncate text-sm font-semibold text-zinc-900">
            {groupName}
          </span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
            {groupParts.length}
          </span>
        </button>
      </div>
      {!isCollapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="w-10 px-4 py-2" />
                <th className="px-4 py-2 font-medium">Part</th>
                <th className="w-28 px-4 py-2 font-medium">Supplier</th>
                <th className="w-24 px-4 py-2 text-right font-medium">Cost</th>
                <th className="w-24 px-4 py-2 text-right font-medium">Price</th>
                <th className="w-20 px-4 py-2 text-right font-medium">On hand</th>
                <th className="w-20 px-4 py-2 text-right font-medium">Reorder @</th>
                <th className="w-28 px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {groupParts.map((p) => {
                const status = stockStatus(p.qtyOnHand, p.reorderLevel);
                return (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${p.name}`}
                        checked={selected.has(p.id)}
                        onChange={() => onToggleSelected(p.id)}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/inventory/${p.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {p.name}
                      </Link>
                      {p.description && (
                        <div className="line-clamp-1 text-xs text-zinc-500">
                          {p.description}
                        </div>
                      )}
                      {p.location && (
                        <div className="mt-0.5 text-xs text-zinc-400">
                          <span className="text-zinc-300">Loc: </span>
                          {p.location}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-600">
                      {p.source ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {p.costPrice != null ? `$${p.costPrice.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {p.unitPrice != null ? `$${p.unitPrice.toFixed(2)}` : "—"}
                      {p.unitPrice != null && p.unit && (
                        <span className="text-zinc-400">{`/${p.unit}`}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {p.qtyOnHand}
                      {p.unit && (
                        <span className="ml-1 text-xs font-normal text-zinc-400">
                          {p.unit}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
                      {p.reorderLevel}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
