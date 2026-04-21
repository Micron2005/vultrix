"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, CardHeader, Field, Input } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

type Vehicle = {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  vin: string | null;
  licensePlate: string | null;
  licenseState: string | null;
  source: "vin" | "plate";
  customer?: {
    id: string;
    label: string;
    phone: string | null;
  } | null;
  dbVehicleId?: string | null;
  details?: Array<{ label: string; value: string }>;
};

type PartMatch = {
  id: string;
  partNumber: string | null;
  name: string;
  description: string | null;
  unitPrice: number | null;
  costPrice: number | null;
  qtyOnHand: number;
  reorderLevel: number;
  source: string | null;
  fitsMake: string | null;
  fitsModel: string | null;
  fitsYearMin: number | null;
  fitsYearMax: number | null;
  fit: "universal" | "tagged";
};

type PartsResponse = {
  vehicle: { year: number | null; make: string | null; model: string | null };
  query: string | null;
  count: number;
  matches: PartMatch[];
};

function customerLabel(c: {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
}) {
  if (c.companyName) return c.companyName;
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : "(no name)";
}

export function VehicleSearchClient() {
  const [mode, setMode] = useState<"vin" | "plate">("vin");
  const [vinInput, setVinInput] = useState("");
  const [plateInput, setPlateInput] = useState("");
  const [stateInput, setStateInput] = useState("");

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [partsQuery, setPartsQuery] = useState("");
  const [partsResult, setPartsResult] = useState<PartsResponse | null>(null);
  const [partsLoading, setPartsLoading] = useState(false);
  const [partsError, setPartsError] = useState<string | null>(null);

  async function fetchParts(v: Vehicle, q: string) {
    setPartsError(null);
    setPartsLoading(true);
    try {
      const params = new URLSearchParams();
      if (v.year != null) params.set("year", String(v.year));
      if (v.make) params.set("make", v.make);
      if (v.model) params.set("model", v.model);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/lookup/parts?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setPartsError(data.error ?? `Parts lookup failed (${res.status})`);
      } else {
        setPartsResult(data as PartsResponse);
      }
    } catch (err) {
      setPartsError(err instanceof Error ? err.message : String(err));
    } finally {
      setPartsLoading(false);
    }
  }

  async function onVehicleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVehicle(null);
    setPartsResult(null);

    if (mode === "vin") {
      const vin = vinInput.trim().toUpperCase().replace(/[\s-]/g, "");
      if (vin.length !== 17) {
        setError(`VIN must be 17 characters (got ${vin.length})`);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/lookup/vin?vin=${encodeURIComponent(vin)}`,
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? `Lookup failed (${res.status})`);
          return;
        }
        const v: Vehicle = {
          year: data.year ? Number(data.year) : null,
          make: data.make ?? null,
          model: data.model ?? null,
          trim: data.trim ?? null,
          vin,
          licensePlate: null,
          licenseState: null,
          source: "vin",
          details: data.details ?? [],
        };
        if (!v.year && !v.make && !v.model) {
          setError(
            "NHTSA didn't return year/make/model for this VIN. Double-check the characters (VINs never contain I, O, or Q).",
          );
          return;
        }
        setVehicle(v);
        void fetchParts(v, partsQuery);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    // plate mode
    const plate = plateInput.trim();
    if (!plate) {
      setError("Enter a plate number");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ plate });
      if (stateInput.trim()) params.set("state", stateInput.trim());
      const res = await fetch(`/api/lookup/plate?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Lookup failed (${res.status})`);
        return;
      }
      if (!data.count) {
        setError(
          `No vehicle in your records matches plate ${data.plate}${
            data.state ? ` (${data.state})` : ""
          }. Paste the VIN instead to decode via NHTSA.`,
        );
        return;
      }
      // Use first match. If there are multiples the user can refine with state.
      const m = data.matches[0];
      const v: Vehicle = {
        year: m.year ?? null,
        make: m.make ?? null,
        model: m.model ?? null,
        trim: m.trim ?? null,
        vin: m.vin ?? null,
        licensePlate: m.licensePlate ?? null,
        licenseState: m.licenseState ?? null,
        source: "plate",
        customer: m.customer
          ? {
              id: m.customer.id,
              label: customerLabel(m.customer),
              phone: m.customer.phone ?? null,
            }
          : null,
        dbVehicleId: m.id,
      };
      setVehicle(v);
      void fetchParts(v, partsQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function onPartsQuerySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicle) return;
    void fetchParts(vehicle, partsQuery);
  }

  const label = vehicle
    ? [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Pick a vehicle">
          <span className="text-xs text-zinc-500 font-normal">
            Decode a VIN via NHTSA or look up an existing vehicle by plate —
            no customer add required.
          </span>
        </CardHeader>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              className={`rounded px-3 py-1 border ${
                mode === "vin"
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-400"
              }`}
              onClick={() => setMode("vin")}
            >
              VIN
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1 border ${
                mode === "plate"
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-400"
              }`}
              onClick={() => setMode("plate")}
            >
              License plate
            </button>
          </div>

          <form onSubmit={onVehicleSubmit} className="space-y-3">
            {mode === "vin" ? (
              <Field label="VIN (17 characters)">
                <Input
                  name="vin"
                  placeholder="e.g. 1HGCM82633A004352"
                  value={vinInput}
                  onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono tracking-wider"
                />
              </Field>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Field label="Plate">
                    <Input
                      name="plate"
                      placeholder="e.g. ABC1234"
                      value={plateInput}
                      onChange={(e) =>
                        setPlateInput(e.target.value.toUpperCase())
                      }
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </Field>
                </div>
                <div>
                  <Field label="State (optional)">
                    <Input
                      name="state"
                      placeholder="TX"
                      maxLength={2}
                      value={stateInput}
                      onChange={(e) =>
                        setStateInput(e.target.value.toUpperCase())
                      }
                    />
                  </Field>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? "Looking up…" : "Find vehicle"}
              </Button>
              {vehicle && (
                <button
                  type="button"
                  className="text-xs text-zinc-500 hover:text-zinc-800"
                  onClick={() => {
                    setVehicle(null);
                    setPartsResult(null);
                    setVinInput("");
                    setPlateInput("");
                    setStateInput("");
                    setError(null);
                  }}
                >
                  Reset
                </button>
              )}
            </div>
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </div>
            )}
          </form>
        </div>

        {vehicle && (
          <div className="border-t border-zinc-200 p-4 space-y-2 bg-zinc-50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-zinc-500">
                  Vehicle
                </div>
                <div className="text-lg font-semibold text-zinc-900">
                  {label || "(unknown)"}
                </div>
                {vehicle.vin && (
                  <div className="font-mono text-xs text-zinc-600">
                    VIN: {vehicle.vin}
                  </div>
                )}
                {vehicle.licensePlate && (
                  <div className="text-xs text-zinc-600">
                    Plate: {vehicle.licensePlate}
                    {vehicle.licenseState ? ` (${vehicle.licenseState})` : ""}
                  </div>
                )}
              </div>
              {vehicle.source === "plate" && vehicle.customer && (
                <div className="text-right text-xs">
                  <div className="uppercase tracking-wider text-zinc-500">
                    Owner
                  </div>
                  <Link
                    href={`/customers/${vehicle.customer.id}`}
                    className="text-zinc-900 hover:underline"
                  >
                    {vehicle.customer.label}
                  </Link>
                  {vehicle.customer.phone && (
                    <div className="text-zinc-600">
                      {vehicle.customer.phone}
                    </div>
                  )}
                  {vehicle.dbVehicleId && (
                    <Link
                      href={`/vehicles/${vehicle.dbVehicleId}`}
                      className="block mt-1 text-blue-700 hover:underline"
                    >
                      Open vehicle record →
                    </Link>
                  )}
                </div>
              )}
            </div>
            {vehicle.source === "vin" &&
              vehicle.details &&
              vehicle.details.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-zinc-600 hover:text-zinc-900">
                    NHTSA details ({vehicle.details.length})
                  </summary>
                  <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                    {vehicle.details.map((d) => (
                      <div
                        key={d.label}
                        className="flex justify-between gap-2"
                      >
                        <dt className="text-zinc-500">{d.label}</dt>
                        <dd className="text-zinc-900 text-right">{d.value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
          </div>
        )}
      </Card>

      {vehicle && (
        <Card>
          <CardHeader title="Parts that fit">
            <span className="text-xs text-zinc-500 font-normal">
              Catalog parts tagged to this vehicle (by fitment fields) or
              untagged universal parts. Filter by keyword to narrow further.
            </span>
          </CardHeader>
          <form
            onSubmit={onPartsQuerySubmit}
            className="p-4 border-b border-zinc-200 flex items-end gap-2"
          >
            <div className="flex-1">
              <Field label="Search parts (name / description / part #)">
                <Input
                  placeholder="e.g. brake pad, oil filter, BP-4352"
                  value={partsQuery}
                  onChange={(e) => setPartsQuery(e.target.value)}
                />
              </Field>
            </div>
            <Button type="submit" disabled={partsLoading}>
              {partsLoading ? "Searching…" : "Search"}
            </Button>
          </form>
          {partsError && (
            <div className="p-4 text-sm text-red-700 bg-red-50 border-b border-red-200">
              {partsError}
            </div>
          )}

          {partsResult && (
            <div>
              <div className="px-4 pt-3 text-xs uppercase tracking-wider text-zinc-500">
                {partsResult.count} match{partsResult.count === 1 ? "" : "es"}
              </div>
              {partsResult.count === 0 ? (
                <div className="p-4 text-sm text-zinc-600">
                  No catalog parts matched
                  {partsQuery ? ` "${partsQuery}"` : ""} for this vehicle. Tag
                  parts with fitment fields on the{" "}
                  <Link
                    href="/inventory"
                    className="text-blue-700 hover:underline"
                  >
                    Inventory page
                  </Link>{" "}
                  so they show up here.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2 font-medium">Part</th>
                      <th className="px-4 py-2 font-medium">Part #</th>
                      <th className="px-4 py-2 font-medium">Fitment</th>
                      <th className="px-4 py-2 font-medium text-right">
                        On hand
                      </th>
                      <th className="px-4 py-2 font-medium text-right">
                        Price
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {partsResult.matches.map((p) => {
                      const fitmentLabel = p.fit === "universal"
                        ? "Universal"
                        : [
                            [p.fitsYearMin, p.fitsYearMax]
                              .filter((n) => n != null)
                              .join("–"),
                            p.fitsMake,
                            p.fitsModel,
                          ]
                            .filter(Boolean)
                            .join(" ");
                      const lowStock =
                        p.qtyOnHand <= p.reorderLevel && p.reorderLevel > 0;
                      return (
                        <tr key={p.id}>
                          <td className="px-4 py-2">
                            <Link
                              href={`/inventory/${p.id}`}
                              className="font-medium text-zinc-900 hover:underline"
                            >
                              {p.name}
                            </Link>
                            {p.description && (
                              <div className="text-xs text-zinc-500">
                                {p.description}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-zinc-600">
                            {p.partNumber ?? "—"}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex rounded px-2 py-0.5 text-xs ${
                                p.fit === "universal"
                                  ? "bg-zinc-100 text-zinc-700"
                                  : "bg-emerald-50 text-emerald-800"
                              }`}
                            >
                              {fitmentLabel || "Tagged"}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            <span
                              className={
                                lowStock ? "text-red-700 font-medium" : ""
                              }
                            >
                              {p.qtyOnHand}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {p.unitPrice != null ? formatMoney(p.unitPrice) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
