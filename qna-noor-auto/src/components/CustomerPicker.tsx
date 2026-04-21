"use client";

import { useMemo, useState } from "react";

export type PickerCustomer = {
  id: string;
  type: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
};

function displayName(c: PickerCustomer): string {
  if (c.type === "BUSINESS" && c.companyName) return c.companyName;
  const full = `${c.firstName} ${c.lastName}`.trim();
  return full || c.companyName || "(no name)";
}

function subline(c: PickerCustomer): string {
  const parts: string[] = [];
  if (c.type === "BUSINESS" && c.companyName) {
    const person = `${c.firstName} ${c.lastName}`.trim();
    if (person) parts.push(person);
  } else if (c.companyName) {
    parts.push(c.companyName);
  }
  if (c.phone) parts.push(c.phone);
  if (c.email) parts.push(c.email);
  return parts.join(" · ");
}

function tokenize(s: string): string[] {
  return s.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function matches(c: PickerCustomer, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const hay = [
    c.firstName,
    c.lastName,
    c.companyName ?? "",
    c.phone ?? "",
    c.email ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

export function CustomerPicker({
  name = "customerId",
  customers,
  placeholder = "Type name, phone, or email…",
  emptyMessage = "No matching customers.",
  defaultSelectedId,
}: {
  name?: string;
  customers: PickerCustomer[];
  placeholder?: string;
  emptyMessage?: string;
  defaultSelectedId?: string;
}) {
  const initialSelected = defaultSelectedId
    ? customers.find((c) => c.id === defaultSelectedId) ?? null
    : null;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PickerCustomer | null>(
    initialSelected,
  );

  const filtered = useMemo(() => {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];
    return customers.filter((c) => matches(c, tokens)).slice(0, 12);
  }, [query, customers]);

  if (selected) {
    return (
      <div className="space-y-2">
        <input type="hidden" name={name} value={selected.id} />
        <div className="flex items-start justify-between gap-3 rounded-md border border-zinc-300 bg-white p-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-zinc-900">
                {displayName(selected)}
              </span>
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                {selected.type === "BUSINESS" ? "Business" : "Individual"}
              </span>
            </div>
            {subline(selected) && (
              <div className="text-xs text-zinc-500">{subline(selected)}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery("");
            }}
            className="text-xs text-zinc-500 hover:text-zinc-900 underline"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
      />
      {query.trim().length > 0 && (
        <div className="rounded-md border border-zinc-200 bg-white max-h-64 overflow-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-zinc-500">
              {emptyMessage}
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c)}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900">
                        {displayName(c)}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                        {c.type === "BUSINESS" ? "Business" : "Individual"}
                      </span>
                    </div>
                    {subline(c) && (
                      <div className="text-xs text-zinc-500">{subline(c)}</div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
