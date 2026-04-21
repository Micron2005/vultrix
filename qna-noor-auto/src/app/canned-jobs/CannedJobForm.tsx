"use client";

import { useState } from "react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

type LaborDraft = {
  key: number;
  description: string;
  hours: string;
  rate: string;
};
type PartDraft = {
  key: number;
  partId: string;
  partNumber: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

type CatalogPart = {
  id: string;
  name: string;
  partNumber: string | null;
  unitPrice: number | null;
  qtyOnHand: number;
};

export function CannedJobForm({
  action,
  catalog,
  initial,
}: {
  action: (fd: FormData) => void;
  catalog: CatalogPart[];
  initial?: {
    name?: string | null;
    description?: string | null;
    category?: string | null;
    notes?: string | null;
    archived?: boolean;
    laborItems?: {
      description: string;
      hours: number;
      rate: number | null;
    }[];
    partItems?: {
      partId: string | null;
      partNumber: string | null;
      description: string;
      quantity: number;
      unitPrice: number | null;
    }[];
  };
}) {
  let keyCounter = 0;
  const [labor, setLabor] = useState<LaborDraft[]>(
    (initial?.laborItems ?? [{ description: "", hours: 0, rate: null }]).map(
      (l) => ({
        key: keyCounter++,
        description: l.description,
        hours: String(l.hours ?? ""),
        rate: l.rate == null ? "" : String(l.rate),
      }),
    ),
  );
  const [parts, setParts] = useState<PartDraft[]>(
    (initial?.partItems ?? []).map((p) => ({
      key: keyCounter++,
      partId: p.partId ?? "",
      partNumber: p.partNumber ?? "",
      description: p.description,
      quantity: String(p.quantity ?? 1),
      unitPrice: p.unitPrice == null ? "" : String(p.unitPrice),
    })),
  );

  function addLabor() {
    setLabor((rows) => [
      ...rows,
      { key: keyCounter++, description: "", hours: "", rate: "" },
    ]);
  }
  function removeLabor(key: number) {
    setLabor((rows) => rows.filter((r) => r.key !== key));
  }
  function updateLabor(key: number, patch: Partial<LaborDraft>) {
    setLabor((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }
  function addPart() {
    setParts((rows) => [
      ...rows,
      {
        key: keyCounter++,
        partId: "",
        partNumber: "",
        description: "",
        quantity: "1",
        unitPrice: "",
      },
    ]);
  }
  function removePart(key: number) {
    setParts((rows) => rows.filter((r) => r.key !== key));
  }
  function updatePart(key: number, patch: Partial<PartDraft>) {
    setParts((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }
  function onPartCatalogChange(key: number, value: string) {
    if (!value) {
      updatePart(key, { partId: "" });
      return;
    }
    const c = catalog.find((p) => p.id === value);
    updatePart(key, {
      partId: value,
      partNumber: c?.partNumber ?? "",
      description: c?.name ?? "",
      unitPrice: c?.unitPrice == null ? "" : String(c.unitPrice),
    });
  }

  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Name (required)">
          <Input
            name="name"
            required
            defaultValue={initial?.name ?? ""}
            placeholder="Front brake service"
          />
        </Field>
        <Field label="Category">
          <Input
            name="category"
            defaultValue={initial?.category ?? ""}
            placeholder="Brakes"
          />
        </Field>
      </div>
      <Field label="Short description (shown when picking preset)">
        <Input
          name="description"
          defaultValue={initial?.description ?? ""}
          placeholder="Replace front pads, machine or replace rotors as needed"
        />
      </Field>
      <Field label="Internal notes (not shown to customer)">
        <Textarea
          name="notes"
          rows={3}
          defaultValue={initial?.notes ?? ""}
          placeholder="Remember to torque to 80 ft-lb, re-lube slide pins."
        />
      </Field>
      {initial && (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="archived"
            defaultChecked={initial.archived ?? false}
            className="rounded border-zinc-300"
          />
          Archive this preset (hide from the Apply preset dropdown)
        </label>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-zinc-900">Labor</h3>
          <Button type="button" variant="ghost" size="sm" onClick={addLabor}>
            + Add labor
          </Button>
        </div>
        {labor.length === 0 ? (
          <p className="text-sm text-zinc-500">No labor items.</p>
        ) : (
          <div className="space-y-2">
            {labor.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-12 gap-2 items-end"
              >
                <div className="col-span-7">
                  <Input
                    name="laborDescription[]"
                    placeholder="Replace front brake pads"
                    value={row.description}
                    onChange={(e) =>
                      updateLabor(row.key, { description: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    name="laborHours[]"
                    type="number"
                    step="0.1"
                    placeholder="Hours"
                    value={row.hours}
                    onChange={(e) =>
                      updateLabor(row.key, { hours: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    name="laborRate[]"
                    type="number"
                    step="0.01"
                    placeholder="Rate (opt)"
                    value={row.rate}
                    onChange={(e) =>
                      updateLabor(row.key, { rate: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLabor(row.key)}
                    aria-label="Remove labor"
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-zinc-900">Parts</h3>
          <Button type="button" variant="ghost" size="sm" onClick={addPart}>
            + Add part
          </Button>
        </div>
        {parts.length === 0 ? (
          <p className="text-sm text-zinc-500">No parts.</p>
        ) : (
          <div className="space-y-4">
            {parts.map((row, idx) => (
              <div
                key={row.key}
                className="rounded border border-zinc-200 bg-zinc-50 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">
                    Part {idx + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removePart(row.key)}
                    aria-label="Remove part"
                  >
                    ✕ Remove
                  </Button>
                </div>
                <Field label="Name / description">
                  <Input
                    name="partDescription[]"
                    placeholder="e.g. Front brake pads (ceramic), AC condenser, Engine oil (5W-30)"
                    value={row.description}
                    onChange={(e) =>
                      updatePart(row.key, { description: e.target.value })
                    }
                  />
                </Field>
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Field label="Catalog (optional)">
                      <Select
                        name="partId[]"
                        value={row.partId}
                        onChange={(e) =>
                          onPartCatalogChange(row.key, e.target.value)
                        }
                      >
                        <option value="">Free-text (no catalog link)</option>
                        {catalog.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.partNumber ? ` · ${c.partNumber}` : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <div className="col-span-3">
                    <Field label="Part #">
                      <Input
                        name="partNumber[]"
                        placeholder="optional"
                        value={row.partNumber}
                        onChange={(e) =>
                          updatePart(row.key, { partNumber: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                  <div className="col-span-2">
                    <Field label="Qty">
                      <Input
                        name="partQty[]"
                        type="number"
                        step="1"
                        placeholder="1"
                        value={row.quantity}
                        onChange={(e) =>
                          updatePart(row.key, { quantity: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                  <div className="col-span-2">
                    <Field label="Price">
                      <Input
                        name="partUnitPrice[]"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={row.unitPrice}
                        onChange={(e) =>
                          updatePart(row.key, { unitPrice: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-4 border-t border-zinc-200">
        <Button type="submit">Save preset</Button>
      </div>
    </form>
  );
}
