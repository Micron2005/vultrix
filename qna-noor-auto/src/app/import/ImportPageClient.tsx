"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import type { ImportType } from "./fields";
import { ImportClient } from "./ImportClient";
import { MappedImportClient } from "./MappedImportClient";

type ImportOption = { id: ImportType; label: string };

export function ImportPageClient({
  availableTypes,
  showIdentifixImport,
}: {
  availableTypes: ImportOption[];
  showIdentifixImport: boolean;
}) {
  const [selected, setSelected] = useState<ImportType>(
    availableTypes[0]?.id ?? "customers",
  );
  const description =
    selected === "money"
      ? "Import income and expenses from a bank or bookkeeping CSV. Review how signed amounts will be classified before importing."
      : selected === "calendar"
        ? "Import calendar events from a CSV and review their dates and local times before adding them."
        : showIdentifixImport
          ? "Migrate customers and vehicles from Identifix Shop Management (or any CSV export)"
          : "Upload a CSV and map columns to bring your customer and vehicle data into Vultrix.";

  return (
    <>
      <PageHeader title="Import CSV" description={description} />
      <Card className="mb-4 min-w-0">
        <CardHeader title="What would you like to import?" />
        <div className="grid min-w-0 grid-cols-1 gap-2 p-4 sm:grid-cols-3">
          {availableTypes.map((option) => (
            <label
              key={option.id}
              className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-3 text-sm ${
                selected === option.id
                  ? "border-zinc-500 bg-zinc-100 font-medium text-zinc-900"
                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <input
                type="radio"
                name="importType"
                value={option.id}
                checked={selected === option.id}
                onChange={() => setSelected(option.id)}
                className="shrink-0 accent-zinc-800"
              />
              <span className="min-w-0">{option.label}</span>
            </label>
          ))}
        </div>
      </Card>

      {selected === "customers" && showIdentifixImport && (
        <>
          <Card className="mb-4 min-w-0 border-blue-300 bg-blue-50">
            <div className="p-4 text-sm text-zinc-800">
              <p className="mb-1 font-semibold text-blue-900">
                Got an Identifix multi-file export (A.csv + B.csv + C.csv)?
              </p>
              <p>
                Use the dedicated{" "}
                <Link
                  href="/import/identifix"
                  className="font-medium text-blue-900 underline"
                >
                  Identifix import page
                </Link>{" "}
                instead — it keeps customer names linked to vehicles and imports
                invoice history.
              </p>
            </div>
          </Card>
          <Card className="mb-4 min-w-0">
            <CardHeader title="How to export from Identifix Shop Management" />
            <div className="space-y-2 p-4 text-sm text-zinc-700">
              <p>
                Identifix Shop Management (like most shop management systems)
                supports exporting customers and vehicles to CSV. The exact
                menu varies by version — common paths:
              </p>
              <ul className="ml-5 list-disc space-y-1 text-zinc-600">
                <li>
                  <strong>Reports → Customer List → Export to CSV</strong>, or
                </li>
                <li>
                  <strong>Tools → Data Export / Backup → CSV</strong>, or
                </li>
                <li>
                  <strong>Setup → Data Tools → Export</strong>.
                </li>
              </ul>
              <p>
                If you can&rsquo;t find an export option, contact Identifix
                support and ask for a CSV of your customer + vehicle data.
                They&rsquo;re required to give you your own data.
              </p>
              <p>
                Once you have the CSV, upload it below. You&rsquo;ll then map
                each CSV column to a field in this system (e.g. their
                &ldquo;Cust First Name&rdquo; column → our{" "}
                <code className="rounded bg-zinc-100 px-1 text-xs">
                  First name
                </code>{" "}
                field).
              </p>
            </div>
          </Card>
        </>
      )}

      {availableTypes.some((option) => option.id === selected) &&
        selected === "customers" && <ImportClient />}
      {availableTypes.some((option) => option.id === selected) &&
        selected === "money" && <MappedImportClient type="money" />}
      {availableTypes.some((option) => option.id === selected) &&
        selected === "calendar" && <MappedImportClient type="calendar" />}
      {availableTypes.length === 0 && (
        <Card className="p-4 text-sm text-zinc-600">
          No import types are enabled for this account.
        </Card>
      )}
    </>
  );
}
