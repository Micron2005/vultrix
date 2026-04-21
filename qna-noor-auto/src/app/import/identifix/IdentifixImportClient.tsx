"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Card, CardHeader } from "@/components/ui";
import {
  runCustomersImport,
  runVehiclesImport,
  runInvoicesImport,
  wipeOrphans,
  resetImportedData,
  type StepResult,
} from "./actions";

export function IdentifixImportClient() {
  return (
    <>
      <ResetCard />
      <WipeCard />
      <StepCard
        step="1"
        title="Customers (A.csv)"
        fileField="customersCsv"
        hint="One row per customer. Columns include Prefix, FirstName, LastName, Suffix, PhoneNo1, Email1, Address1, IsCompany, Id."
        action={runCustomersImport}
      />
      <StepCard
        step="2"
        title="Vehicles (B.csv)"
        fileField="vehiclesCsv"
        hint="One row per vehicle. Columns include VIN, LicensePlate, Year, Make, Model, Engine, CustomerId, Id. Run AFTER customers."
        action={runVehiclesImport}
      />
      <StepCard
        step="3"
        title="Invoice history (C.csv) — optional"
        fileField="invoicesCsv"
        hint="Multi-row per invoice. Matched to vehicles by VIN. Can take a minute. Run AFTER vehicles."
        action={runInvoicesImport}
      />
    </>
  );
}

function ResetCard() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<StepResult | null>(null);
  const [confirm, setConfirm] = useState("");
  const armed = confirm === "DELETE EVERYTHING";
  return (
    <Card className="mb-4 border-red-300">
      <CardHeader title="⚠️ Reset · Delete ALL imported data (danger)" />
      <div className="p-6 space-y-3">
        <p className="text-sm text-zinc-700">
          Deletes <strong>every</strong> customer, vehicle, appointment, and
          repair order in your database. Use this before a fresh Identifix
          import if earlier imports left bad data behind. This is irreversible.
        </p>
        <p className="text-sm text-zinc-700">
          Type <code className="bg-red-100 px-1 rounded">DELETE EVERYTHING</code>{" "}
          in the box below to arm the button.
        </p>
        <input
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="DELETE EVERYTHING"
          className="border border-zinc-300 rounded px-2 py-1 text-sm font-mono w-72"
        />
        <div>
          <Button
            type="button"
            variant="danger"
            disabled={pending || !armed}
            onClick={() => {
              startTransition(async () => {
                const r = await resetImportedData(confirm);
                setResult(r);
                setConfirm("");
              });
            }}
          >
            {pending
              ? "Wiping…"
              : armed
                ? "Delete ALL customers, vehicles, ROs, appointments"
                : "(type DELETE EVERYTHING to arm)"}
          </Button>
        </div>
        {result && <ResultBlock result={result} />}
      </div>
    </Card>
  );
}

function WipeCard() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<StepResult | null>(null);
  return (
    <Card className="mb-4">
      <CardHeader title="Step 0 · Heal data from failed prior import (recommended)" />
      <div className="p-6 space-y-3">
        <p className="text-sm text-zinc-700">
          Your Customers list currently shows hex IDs (e.g.{" "}
          <code className="bg-zinc-100 px-1 rounded">5ea45f59cd21e818c03a6324</code>
          ) because a previous import put the Identifix <code>Id</code> into the
          name column. Click below to move those IDs into the{" "}
          <code>externalId</code> column so the next step (uploading A.csv) will{" "}
          <strong>update</strong> those rows with real names instead of creating
          duplicates. Also deletes any truly-blank ghost rows. Safe to re-run.
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const r = await wipeOrphans();
              setResult(r);
            });
          }}
        >
          {pending ? "Working…" : "Heal prior import"}
        </Button>
        {result && <ResultBlock result={result} />}
      </div>
    </Card>
  );
}

function StepCard({
  step,
  title,
  fileField,
  hint,
  action,
}: {
  step: string;
  title: string;
  fileField: string;
  hint: string;
  action: (prev: StepResult | null, fd: FormData) => Promise<StepResult>;
}) {
  const [state, formAction, pending] = useActionState<
    StepResult | null,
    FormData
  >(action, null);
  const [name, setName] = useState<string>("");
  return (
    <Card className="mb-4">
      <CardHeader title={`Step ${step} · ${title}`} />
      <form action={formAction} className="p-6 space-y-3">
        <input
          name={fileField}
          type="file"
          accept=".csv,text/csv"
          required
          className="text-sm"
          onChange={(e) => setName(e.target.files?.[0]?.name ?? "")}
        />
        {name && (
          <p className="text-xs text-zinc-600">
            Loaded <strong>{name}</strong>
          </p>
        )}
        <p className="text-xs text-zinc-500">{hint}</p>
        <Button disabled={pending} type="submit">
          {pending ? "Importing…" : `Run step ${step}`}
        </Button>
        {state && <ResultBlock result={state} />}
      </form>
    </Card>
  );
}

function ResultBlock({ result }: { result: StepResult }) {
  return (
    <div
      className={`mt-2 rounded border p-3 text-sm ${
        result.ok
          ? "border-green-300 bg-green-50 text-green-900"
          : "border-red-300 bg-red-50 text-red-900"
      }`}
    >
      <p className="font-medium">{result.message}</p>
      {Object.keys(result.stats).length > 0 && (
        <ul className="mt-1 text-xs">
          {Object.entries(result.stats).map(([k, v]) => (
            <li key={k}>
              <span className="text-zinc-600">{k}:</span>{" "}
              <span className="font-mono">{v}</span>
            </li>
          ))}
        </ul>
      )}
      {result.errors.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs">
            {result.errors.length} warning/error
            {result.errors.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-1 ml-4 list-disc text-xs">
            {result.errors.slice(0, 30).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
