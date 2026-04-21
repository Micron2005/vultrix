"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { decodeVinAction } from "@/app/vehicles/actions";
import type { VinDecodeResult } from "@/lib/vin";

type VehicleOption = {
  id: string;
  label: string;
};

type Props = {
  customerId: string;
  action: (fd: FormData) => void | Promise<void>;
  vehicles: VehicleOption[];
};

export function VehiclePickerOrCreate({
  customerId,
  action,
  vehicles,
}: Props) {
  const [mode, setMode] = useState<"existing" | "new">(
    vehicles.length > 0 ? "existing" : "new",
  );

  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  const [engine, setEngine] = useState("");
  const [color, setColor] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [licenseState, setLicenseState] = useState("");
  const [mileage, setMileage] = useState("");
  const [vinMsg, setVinMsg] = useState<string | null>(null);
  const [isDecoding, startDecode] = useTransition();

  function applyDecode(r: VinDecodeResult) {
    if (r.errorText && !r.make) {
      setVinMsg(`NHTSA: ${r.errorText}`);
      return;
    }
    if (r.year) setYear(r.year.toString());
    if (r.make) setMake(r.make);
    if (r.model) setModel(r.model);
    if (r.trim) setTrim(r.trim);
    if (r.engine) setEngine(r.engine);
    const bits = [r.year, r.make, r.model].filter(Boolean).join(" ");
    setVinMsg(
      bits
        ? `Decoded: ${bits}${r.errorText ? ` (${r.errorText})` : ""}`
        : (r.errorText ?? "Decoded"),
    );
  }

  function handleDecode() {
    if (!vin || vin.trim().length < 11) {
      setVinMsg("Enter at least 11 VIN characters");
      return;
    }
    setVinMsg("Decoding…");
    startDecode(async () => {
      try {
        const result = await decodeVinAction(vin.trim());
        applyDecode(result);
      } catch (err) {
        setVinMsg(err instanceof Error ? err.message : "VIN decode failed");
      }
    });
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="mode" value={mode} />

      {vehicles.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            className={`rounded px-3 py-1 border ${
              mode === "existing"
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-400"
            }`}
            onClick={() => setMode("existing")}
          >
            Existing vehicle
          </button>
          <button
            type="button"
            className={`rounded px-3 py-1 border ${
              mode === "new"
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-400"
            }`}
            onClick={() => setMode("new")}
          >
            + Add new vehicle
          </button>
        </div>
      )}

      {mode === "existing" ? (
        <Field label="Vehicle">
          <Select name="vehicleId" required={mode === "existing"} defaultValue="">
            <option value="" disabled>
              Select a vehicle…
            </option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <div className="space-y-4">
          <div>
            <Field label="VIN (optional)">
              <div className="flex gap-2">
                <Input
                  name="vin"
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  placeholder="17-digit VIN"
                  maxLength={17}
                  className="font-mono uppercase"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleDecode}
                  disabled={isDecoding}
                >
                  {isDecoding ? "Decoding…" : "Decode VIN"}
                </Button>
              </div>
            </Field>
            {vinMsg && <p className="mt-1 text-xs text-zinc-500">{vinMsg}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Year">
              <Input
                name="year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                inputMode="numeric"
              />
            </Field>
            <Field label="Make">
              <Input
                name="make"
                value={make}
                onChange={(e) => setMake(e.target.value)}
              />
            </Field>
            <Field label="Model">
              <Input
                name="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </Field>
            <Field label="Trim">
              <Input
                name="trim"
                value={trim}
                onChange={(e) => setTrim(e.target.value)}
              />
            </Field>
            <Field label="Engine">
              <Input
                name="engine"
                value={engine}
                onChange={(e) => setEngine(e.target.value)}
              />
            </Field>
            <Field label="Color">
              <Input
                name="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="License plate">
              <Input
                name="licensePlate"
                value={licensePlate}
                onChange={(e) =>
                  setLicensePlate(e.target.value.toUpperCase())
                }
              />
            </Field>
            <Field label="State">
              <Input
                name="licenseState"
                value={licenseState}
                onChange={(e) =>
                  setLicenseState(e.target.value.toUpperCase())
                }
                maxLength={2}
                placeholder="TX"
              />
            </Field>
            <Field label="Mileage">
              <Input
                name="mileage"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                inputMode="numeric"
              />
            </Field>
          </div>
          <p className="text-xs text-zinc-500">
            Tip: paste a VIN and click <em>Decode VIN</em> to auto-fill
            year / make / model / trim / engine.
          </p>
        </div>
      )}

      <Button type="submit">Continue</Button>
    </form>
  );
}
