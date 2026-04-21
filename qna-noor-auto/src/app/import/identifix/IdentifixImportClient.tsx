"use client";

import { useActionState, useState } from "react";
import { Button, Card, CardHeader } from "@/components/ui";
import { runIdentifixImport, type IdentifixImportSummary } from "./actions";

export function IdentifixImportClient() {
  const [state, action, isPending] = useActionState<
    IdentifixImportSummary | null,
    FormData
  >(runIdentifixImport, null);

  const [aName, setANm] = useState<string>("");
  const [bName, setBNm] = useState<string>("");
  const [cName, setCNm] = useState<string>("");

  return (
    <form action={action}>
      <Card className="mb-4">
        <CardHeader title="1. Upload files" />
        <div className="p-6 space-y-4">
          <FileRow
            id="customersCsv"
            label="Customers (A)"
            hint="CSV with columns: Prefix, FirstName, LastName, Suffix, PhoneNo1, Email1, Address1, Address2, IsCompany, Id, …"
            onName={setANm}
            name={aName}
          />
          <FileRow
            id="vehiclesCsv"
            label="Vehicles (B)"
            hint="CSV with columns: VIN, LicensePlate, LicenseState, Year, Make, Model, Engine, Color, CustomerId, Id, …"
            onName={setBNm}
            name={bName}
          />
          <FileRow
            id="invoicesCsv"
            label="Invoices (C) — optional"
            hint="Multi-row per invoice: Invoice:, Date:, Customer:, Vin:, Vehicle:, line items, totals. Takes longer."
            onName={setCNm}
            name={cName}
          />
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader title="2. Cleanup options" />
        <div className="p-6 space-y-3 text-sm text-zinc-700">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="wipeOrphans"
              className="mt-0.5"
              defaultChecked
            />
            <span>
              <strong>Delete blank-name customers first.</strong> Removes any
              customer records with no name and no linked vehicles / ROs —
              usually leftovers from a failed prior import.
            </span>
          </label>
          <p className="text-xs text-zinc-500">
            Records that match by Identifix Id (stored in our{" "}
            <code className="bg-zinc-100 px-1 rounded">externalId</code> field)
            are <strong>updated</strong> in place, not duplicated. Safe to
            re-run.
          </p>
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader title="3. Run" />
        <div className="p-6">
          <Button disabled={isPending} type="submit">
            {isPending ? "Importing…" : "Run import"}
          </Button>
          <p className="mt-2 text-xs text-zinc-500">
            A full import of ~730 customers, ~4,700 vehicles, and ~3,100
            invoices can take 30-90 seconds. Stay on this page.
          </p>
        </div>
      </Card>

      {state && <SummaryCard summary={state} />}
    </form>
  );
}

function FileRow({
  id,
  label,
  hint,
  onName,
  name,
}: {
  id: string;
  label: string;
  hint: string;
  onName: (n: string) => void;
  name: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-zinc-900 mb-1"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="file"
        accept=".csv,text/csv"
        className="text-sm"
        onChange={(e) => onName(e.target.files?.[0]?.name ?? "")}
      />
      {name && (
        <p className="mt-1 text-xs text-zinc-600">
          Loaded <strong>{name}</strong>
        </p>
      )}
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

function SummaryCard({ summary }: { summary: IdentifixImportSummary }) {
  return (
    <Card>
      <CardHeader title={summary.ok ? "Results" : "Error"} />
      <div className="p-6 space-y-3 text-sm">
        {summary.message && (
          <p className={summary.ok ? "text-green-700" : "text-red-700"}>
            {summary.message}
          </p>
        )}
        {summary.cleanup.orphanCustomersDeleted > 0 && (
          <p className="text-zinc-700">
            Deleted{" "}
            <strong>{summary.cleanup.orphanCustomersDeleted}</strong> blank
            customer records from a prior failed import.
          </p>
        )}
        <ResultRow
          label="Customers"
          parts={[
            `${summary.customers.imported} new`,
            `${summary.customers.updated} updated`,
          ]}
        />
        <ResultRow
          label="Vehicles"
          parts={[
            `${summary.vehicles.imported} new`,
            `${summary.vehicles.updated} updated`,
            summary.vehicles.orphans > 0
              ? `${summary.vehicles.orphans} skipped (customer not found)`
              : null,
          ]}
        />
        <ResultRow
          label="Invoices"
          parts={[
            `${summary.invoices.imported} imported`,
            summary.invoices.skipped > 0
              ? `${summary.invoices.skipped} skipped`
              : null,
          ]}
        />
        {Object.keys(summary.invoices.skippedReasons).length > 0 && (
          <details>
            <summary className="cursor-pointer text-zinc-700">
              Why invoices were skipped
            </summary>
            <ul className="mt-1 ml-5 list-disc text-xs text-zinc-600">
              {Object.entries(summary.invoices.skippedReasons).map(
                ([reason, count]) => (
                  <li key={reason}>
                    <code>{reason}</code>: {count}
                  </li>
                ),
              )}
            </ul>
          </details>
        )}
        {summary.errors.length > 0 && (
          <details>
            <summary className="cursor-pointer text-red-700">
              {summary.errors.length} parser warnings
            </summary>
            <ul className="mt-1 ml-5 list-disc text-xs text-red-700">
              {summary.errors.slice(0, 30).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Card>
  );
}

function ResultRow({
  label,
  parts,
}: {
  label: string;
  parts: (string | null)[];
}) {
  const filtered = parts.filter((p): p is string => !!p);
  return (
    <div>
      <span className="font-medium text-zinc-900">{label}:</span>{" "}
      <span className="text-zinc-700">
        {filtered.length ? filtered.join(" · ") : "—"}
      </span>
    </div>
  );
}
