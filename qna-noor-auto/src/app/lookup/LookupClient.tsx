"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, CardHeader, Field, Input } from "@/components/ui";

type VinResponse = {
  vin: string;
  summary: string;
  year: string | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  details: Array<{ label: string; value: string }>;
  errorCode: string;
  errorText: string;
  hasData: boolean;
};

type PlateCustomer = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  phone: string | null;
  email: string | null;
};

type PlateMatch = {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  vin: string | null;
  licensePlate: string | null;
  licenseState: string | null;
  color: string | null;
  mileage: number | null;
  customerId: string;
  customer: PlateCustomer;
};

type PlateResponse = {
  plate: string;
  state: string | null;
  count: number;
  matches: PlateMatch[];
};

function customerLabel(c: PlateCustomer) {
  if (c.companyName) return c.companyName;
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : "(no name)";
}

export function LookupClient() {
  const [vinInput, setVinInput] = useState("");
  const [vinLoading, setVinLoading] = useState(false);
  const [vinResult, setVinResult] = useState<VinResponse | null>(null);
  const [vinError, setVinError] = useState<string | null>(null);

  const [plateInput, setPlateInput] = useState("");
  const [stateInput, setStateInput] = useState("");
  const [plateLoading, setPlateLoading] = useState(false);
  const [plateResult, setPlateResult] = useState<PlateResponse | null>(null);
  const [plateError, setPlateError] = useState<string | null>(null);

  async function onVinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setVinError(null);
    setVinResult(null);
    const vin = vinInput.trim().toUpperCase().replace(/[\s-]/g, "");
    if (vin.length !== 17) {
      setVinError(`VIN must be 17 characters (got ${vin.length})`);
      return;
    }
    setVinLoading(true);
    try {
      const res = await fetch(`/api/lookup/vin?vin=${encodeURIComponent(vin)}`);
      const data = await res.json();
      if (!res.ok) {
        setVinError(data.error ?? `Lookup failed (${res.status})`);
      } else {
        setVinResult(data as VinResponse);
      }
    } catch (err) {
      setVinError(err instanceof Error ? err.message : String(err));
    } finally {
      setVinLoading(false);
    }
  }

  async function onPlateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPlateError(null);
    setPlateResult(null);
    const plate = plateInput.trim();
    if (!plate) {
      setPlateError("Enter a plate number");
      return;
    }
    const params = new URLSearchParams({ plate });
    if (stateInput.trim()) params.set("state", stateInput.trim());
    setPlateLoading(true);
    try {
      const res = await fetch(`/api/lookup/plate?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setPlateError(data.error ?? `Lookup failed (${res.status})`);
      } else {
        setPlateResult(data as PlateResponse);
      }
    } catch (err) {
      setPlateError(err instanceof Error ? err.message : String(err));
    } finally {
      setPlateLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader title="VIN decoder">
          <span className="text-xs text-zinc-500 font-normal">
            Paste a 17-character VIN — looks up year, make, model, trim,
            engine, body, plant, etc. (NHTSA)
          </span>
        </CardHeader>
        <form onSubmit={onVinSubmit} className="p-4 space-y-3">
          <Field label="VIN">
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
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={vinLoading}>
              {vinLoading ? "Looking up…" : "Decode VIN"}
            </Button>
            {vinInput && (
              <button
                type="button"
                className="text-xs text-zinc-500 hover:text-zinc-800"
                onClick={() => {
                  setVinInput("");
                  setVinResult(null);
                  setVinError(null);
                }}
              >
                Clear
              </button>
            )}
          </div>
          {vinError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {vinError}
            </div>
          )}
        </form>

        {vinResult && (
          <div className="border-t border-zinc-200 p-4 space-y-3">
            {vinResult.summary ? (
              <div>
                <div className="text-xs uppercase tracking-wider text-zinc-500">
                  Vehicle
                </div>
                <div className="text-lg font-semibold text-zinc-900">
                  {vinResult.summary}
                </div>
                <div className="font-mono text-xs text-zinc-600">
                  VIN: {vinResult.vin}
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-600">
                NHTSA returned no match for this VIN. Double-check the
                characters (VINs never contain I, O, or Q).
              </div>
            )}

            {vinResult.details.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
                  Details
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {vinResult.details.map((d) => (
                    <div key={d.label} className="flex justify-between gap-2">
                      <dt className="text-zinc-500">{d.label}</dt>
                      <dd className="text-zinc-900 text-right">{d.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {vinResult.errorText && (
              <div className="text-xs text-zinc-500">
                NHTSA note: {vinResult.errorText}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Plate search">
          <span className="text-xs text-zinc-500 font-normal">
            Looks up a vehicle already in your records by license plate.
            Optional state narrows the match.
          </span>
        </CardHeader>
        <form
          onSubmit={onPlateSubmit}
          className="p-4 space-y-3 grid grid-cols-1"
        >
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Field label="Plate">
                <Input
                  name="plate"
                  placeholder="e.g. ABC1234"
                  value={plateInput}
                  onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
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
                  onChange={(e) => setStateInput(e.target.value.toUpperCase())}
                />
              </Field>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={plateLoading}>
              {plateLoading ? "Searching…" : "Search plate"}
            </Button>
            {plateInput && (
              <button
                type="button"
                className="text-xs text-zinc-500 hover:text-zinc-800"
                onClick={() => {
                  setPlateInput("");
                  setStateInput("");
                  setPlateResult(null);
                  setPlateError(null);
                }}
              >
                Clear
              </button>
            )}
          </div>
          {plateError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {plateError}
            </div>
          )}
        </form>

        {plateResult && (
          <div className="border-t border-zinc-200 p-4 space-y-3">
            {plateResult.count === 0 ? (
              <div className="text-sm text-zinc-600">
                No vehicle in your records matches plate{" "}
                <span className="font-mono font-semibold">
                  {plateResult.plate}
                </span>
                {plateResult.state ? ` (${plateResult.state})` : ""}. If this
                is a new customer, paste the VIN into the decoder on the left
                instead.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs uppercase tracking-wider text-zinc-500">
                  {plateResult.count} match{plateResult.count === 1 ? "" : "es"}
                </div>
                {plateResult.matches.map((m) => {
                  const label = [m.year, m.make, m.model, m.trim]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <div
                      key={m.id}
                      className="rounded border border-zinc-200 p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            href={`/vehicles/${m.id}`}
                            className="font-semibold text-zinc-900 hover:underline"
                          >
                            {label || "(vehicle)"}
                          </Link>
                          {m.vin && (
                            <div className="font-mono text-xs text-zinc-600">
                              VIN: {m.vin}
                            </div>
                          )}
                          <div className="text-xs text-zinc-600">
                            Plate: {m.licensePlate}
                            {m.licenseState ? ` (${m.licenseState})` : ""}
                            {m.color ? ` · ${m.color}` : ""}
                            {m.mileage != null
                              ? ` · ${m.mileage.toLocaleString()} mi`
                              : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs uppercase tracking-wider text-zinc-500">
                            Owner
                          </div>
                          <Link
                            href={`/customers/${m.customerId}`}
                            className="text-sm text-zinc-900 hover:underline"
                          >
                            {customerLabel(m.customer)}
                          </Link>
                          {m.customer.phone && (
                            <div className="text-xs text-zinc-600">
                              {m.customer.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
