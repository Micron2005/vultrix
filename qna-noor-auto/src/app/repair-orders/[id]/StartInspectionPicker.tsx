"use client";

import { useState } from "react";

type Template = { id: string; name: string; itemCount: number };

export function StartInspectionPicker({
  templates,
  action,
}: {
  templates: Template[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-4">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="rounded-md bg-[var(--vx-accent-600)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--vx-accent-700)]">Start inspection</button>
      ) : (
        <form action={action} className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-xs font-medium text-zinc-600">
            Checklist
            <select name="templateId" className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900" required defaultValue={templates[0]?.id}>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name} · {template.itemCount} items</option>)}
            </select>
          </label>
          <button type="submit" className="h-10 rounded-md bg-[var(--vx-accent-600)] px-3 text-sm font-medium text-white">Start</button>
          <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-md border border-zinc-300 px-3 text-sm">Cancel</button>
        </form>
      )}
    </div>
  );
}
