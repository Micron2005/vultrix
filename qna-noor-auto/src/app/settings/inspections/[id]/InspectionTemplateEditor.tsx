"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui";

type Item = { section: string; name: string };
type InitialItem = Item & { id?: string };
type EditableItem = Item & { clientId: string };

function newClientId() {
  return globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}-${Math.random()}`;
}

export function InspectionTemplateEditor({
  initialItems,
  saveAction,
}: {
  initialItems: InitialItem[];
  saveAction: (items: Item[]) => Promise<void>;
}) {
  const [items, setItems] = useState<EditableItem[]>(() =>
    initialItems.map((item, index) => ({
      section: item.section,
      name: item.name,
      clientId: item.id ?? `initial-${index}`,
    })),
  );
  const [pending, startTransition] = useTransition();
  function update(index: number, patch: Partial<Item>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function move(index: number, delta: number) {
    setItems((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div>
          <h2 className="font-semibold text-zinc-900">Checklist items</h2>
          <p className="text-xs text-zinc-500">{items.length} of 80 items</p>
        </div>
        <button type="button" disabled={items.length >= 80} onClick={() => setItems((current) => [...current, { section: "New section", name: "New item", clientId: newClientId() }])} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50">+ Add item</button>
      </div>
      <div className="space-y-2 p-4">
        {items.map((item, index) => (
          <div key={item.clientId} className="grid grid-cols-1 gap-2 rounded-md border border-zinc-200 p-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
            <label className="text-xs font-medium text-zinc-600">Section<Input value={item.section} onChange={(e) => update(index, { section: e.target.value })} /></label>
            <label className="text-xs font-medium text-zinc-600">Item name<Input value={item.name} onChange={(e) => update(index, { name: e.target.value })} /></label>
            <div className="flex gap-1">
              <button type="button" onClick={() => move(index, -1)} className="rounded border px-2 py-1 text-sm" aria-label="Move up">↑</button>
              <button type="button" onClick={() => move(index, 1)} className="rounded border px-2 py-1 text-sm" aria-label="Move down">↓</button>
              <button type="button" onClick={() => setItems((current) => current.filter((_, i) => i !== index))} className="rounded border border-red-200 px-2 py-1 text-sm text-red-600" aria-label="Remove item">×</button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setItems((current) => [...current, { section: "New section", name: "", clientId: newClientId() }])} className="text-sm font-medium text-[var(--vx-accent-600)] hover:underline">+ Add section</button>
        <div>
          <button type="button" disabled={pending} onClick={() => startTransition(() => { void saveAction(items.map(({ section, name }) => ({ section, name }))); })} className="rounded-md bg-[var(--vx-accent-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--vx-accent-700)] disabled:opacity-60">{pending ? "Saving…" : "Save checklist"}</button>
        </div>
      </div>
    </section>
  );
}
