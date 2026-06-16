"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";
import { MileageInput } from "@/components/MileageInput";
import { decodeVinAction } from "./actions";
import type { VinDecodeResult } from "@/lib/vin";

type VehicleInit = {
  id?: string;
  customerId?: string;
  vin?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  engine?: string | null;
  transmission?: string | null;
  drivetrain?: string | null;
  bodyStyle?: string | null;
  color?: string | null;
  licensePlate?: string | null;
  licenseState?: string | null;
  mileage?: number | null;
  notes?: string | null;
};

export function VehicleForm({
  action,
  vehicle,
  customerId,
  submitLabel = "Save",
}: {
  action: (fd: FormData) => void | Promise<void>;
  vehicle?: VehicleInit;
  customerId?: string;
  submitLabel?: string;
}) {
  const [vinMsg, setVinMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [vin, setVin] = useState(vehicle?.vin ?? "");
  const [year, setYear] = useState(vehicle?.year?.toString() ?? "");
  const [make, setMake] = useState(vehicle?.make ?? "");
  const [model, setModel] = useState(vehicle?.model ?? "");
  const [trim, setTrim] = useState(vehicle?.trim ?? "");
  const [engine, setEngine] = useState(vehicle?.engine ?? "");
  const [transmission, setTransmission] = useState(
    vehicle?.transmission ?? "",
  );
  const [drivetrain, setDrivetrain] = useState(vehicle?.drivetrain ?? "");
  const [bodyStyle, setBodyStyle] = useState(vehicle?.bodyStyle ?? "");

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
    if (r.transmission) setTransmission(r.transmission);
    if (r.drivetrain) setDrivetrain(r.drivetrain);
    if (r.bodyStyle) setBodyStyle(r.bodyStyle);
    const bits = [r.year, r.make, r.model].filter(Boolean).join(" ");
    setVinMsg(bits ? `Decoded: ${bits}${r.errorText ? ` (${r.errorText})` : ""}` : r.errorText ?? "Decoded");
  }

  function handleDecode() {
    if (!vin || vin.trim().length < 11) {
      setVinMsg("Enter at least 11 VIN characters");
      return;
    }
    setVinMsg("Decoding…");
    startTransition(async () => {
      try {
        const result = await decodeVinAction(vin.trim());
        applyDecode(result);
      } catch (err) {
        setVinMsg(err instanceof Error ? err.message : "VIN decode failed");
      }
    });
  }

  return (
    <form action={action} className="space-y-6">
      <input
        type="hidden"
        name="customerId"
        value={vehicle?.customerId ?? customerId ?? ""}
      />

      <div>
        <Field label="VIN">
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
              disabled={isPending}
            >
              {isPending ? "Decoding…" : "Decode VIN"}
            </Button>
          </div>
        </Field>
        {vinMsg && (
          <p className="mt-1 text-xs text-zinc-500">{vinMsg}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <Field label="Transmission">
          <Input
            name="transmission"
            value={transmission}
            onChange={(e) => setTransmission(e.target.value)}
          />
        </Field>
        <Field label="Drivetrain">
          <Input
            name="drivetrain"
            value={drivetrain}
            onChange={(e) => setDrivetrain(e.target.value)}
          />
        </Field>
        <Field label="Body style">
          <Input
            name="bodyStyle"
            value={bodyStyle}
            onChange={(e) => setBodyStyle(e.target.value)}
          />
        </Field>
        <Field label="Color">
          <Input name="color" defaultValue={vehicle?.color ?? ""} />
        </Field>
        <Field label="License plate">
          <Input
            name="licensePlate"
            defaultValue={vehicle?.licensePlate ?? ""}
            className="uppercase"
          />
        </Field>
        <Field label="Plate state">
          <Input
            name="licenseState"
            defaultValue={vehicle?.licenseState ?? ""}
            maxLength={2}
            className="uppercase"
          />
        </Field>
        <Field label="Mileage">
          <MileageInput name="mileage" defaultValue={vehicle?.mileage ?? null} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea name="notes" rows={3} defaultValue={vehicle?.notes ?? ""} />
      </Field>

      <div className="flex gap-2">
        <SaveButton>{submitLabel}</SaveButton>
      </div>
    </form>
  );
}
