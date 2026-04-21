"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardHeader, Field, Select } from "@/components/ui";
import { parseCsvHeaders, runImport } from "./actions";
import { LOGICAL_FIELDS, type ColumnMap, type LogicalField } from "./fields";

type Parsed = {
  headers: string[];
  rowCount: number;
  sample: Record<string, string>[];
};

const HEADER_HINTS: Record<LogicalField, RegExp[]> = {
  firstName: [/first.*name/i, /^f.*name$/i, /^fname$/i],
  lastName: [/last.*name/i, /^l.*name$/i, /^lname$/i, /surname/i],
  fullName: [/^name$/i, /full.*name/i, /customer.*name/i],
  companyName: [/company/i, /business/i, /organization/i],
  email: [/e-?mail/i],
  phone: [/^phone/i, /home.*phone/i, /primary.*phone/i, /cell/i, /mobile/i],
  altPhone: [/alt.*phone/i, /work.*phone/i, /secondary.*phone/i],
  street: [/street/i, /address.*1/i, /^address$/i],
  city: [/city/i],
  state: [/state/i, /province/i],
  zip: [/zip/i, /postal/i],
  customerNotes: [/cust.*note/i, /customer.*note/i],
  vin: [/vin/i],
  year: [/year/i, /model.*year/i],
  make: [/make/i, /manufacturer/i],
  model: [/^model$/i, /vehicle.*model/i],
  licensePlate: [/plate/i, /tag/i, /license/i],
  mileage: [/mileage/i, /odometer/i],
  vehicleNotes: [/vehicle.*note/i, /veh.*note/i],
};

function autoMap(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  for (const f of LOGICAL_FIELDS) {
    const hints = HEADER_HINTS[f.key];
    const match = headers.find((h) => hints.some((rx) => rx.test(h)));
    if (match) map[f.key] = match;
  }
  return map;
}

export function ImportClient() {
  const [csvText, setCsvText] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [columnMap, setColumnMap] = useState<ColumnMap>({});
  const [decodeVins, setDecodeVins] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    customersCreated: number;
    vehiclesCreated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  async function handleFile(f: File) {
    const text = await f.text();
    setCsvText(text);
    setFilename(f.name);
    setResult(null);
    const info = await parseCsvHeaders(text);
    setParsed(info);
    setColumnMap(autoMap(info.headers));
  }

  function handleRun() {
    if (!csvText) return;
    startTransition(async () => {
      const r = await runImport(csvText, JSON.stringify(columnMap), { decodeVins });
      setResult(r);
    });
  }

  return (
    <>
      <Card className="mb-4">
        <CardHeader title="1. Upload CSV" />
        <div className="p-6">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="text-sm"
          />
          {filename && (
            <p className="mt-2 text-sm text-zinc-600">
              Loaded <strong>{filename}</strong>
              {parsed && ` · ${parsed.rowCount} rows · ${parsed.headers.length} columns`}
            </p>
          )}
        </div>
      </Card>

      {parsed && (
        <>
          <Card className="mb-4">
            <CardHeader title="2. Map columns">
              <span className="text-xs text-zinc-500">
                Auto-matched where possible. Set &ldquo;—&rdquo; to skip a field.
              </span>
            </CardHeader>
            <div className="p-6 space-y-6">
              {(["customer", "vehicle"] as const).map((group) => (
                <div key={group}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    {group} fields
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {LOGICAL_FIELDS.filter((f) => f.group === group).map((f) => (
                      <Field key={f.key} label={f.label}>
                        <Select
                          value={columnMap[f.key] ?? ""}
                          onChange={(e) =>
                            setColumnMap((m) => ({
                              ...m,
                              [f.key]: e.target.value || undefined,
                            }))
                          }
                        >
                          <option value="">— skip —</option>
                          {parsed.headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    ))}
                  </div>
                </div>
              ))}

              <div className="pt-2">
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={decodeVins}
                    onChange={(e) => setDecodeVins(e.target.checked)}
                  />
                  Auto-fill missing year/make/model from VIN using NHTSA (free)
                </label>
              </div>
            </div>
          </Card>

          <Card className="mb-4">
            <CardHeader title="3. Preview" />
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50">
                  <tr>
                    {LOGICAL_FIELDS.filter((f) => columnMap[f.key]).map((f) => (
                      <th key={f.key} className="px-2 py-1 text-left font-medium">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {parsed.sample.map((row, i) => (
                    <tr key={i}>
                      {LOGICAL_FIELDS.filter((f) => columnMap[f.key]).map((f) => (
                        <td key={f.key} className="px-2 py-1">
                          {row[columnMap[f.key]!] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.sample.length === 0 && (
                <p className="text-sm text-zinc-500">No preview rows.</p>
              )}
            </div>
          </Card>

          <Card className="mb-4">
            <CardHeader title="4. Run import" />
            <div className="p-6">
              <Button onClick={handleRun} disabled={isPending}>
                {isPending ? "Importing…" : `Import ${parsed.rowCount} rows`}
              </Button>
              {result && (
                <div className="mt-4 text-sm space-y-1">
                  <p className="text-green-700">
                    Created {result.customersCreated} customer
                    {result.customersCreated === 1 ? "" : "s"} and{" "}
                    {result.vehiclesCreated} vehicle
                    {result.vehiclesCreated === 1 ? "" : "s"}.
                  </p>
                  {result.skipped > 0 && (
                    <p className="text-zinc-600">
                      Skipped {result.skipped} row
                      {result.skipped === 1 ? "" : "s"} with no name.
                    </p>
                  )}
                  {result.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-red-700">
                        {result.errors.length} error
                        {result.errors.length === 1 ? "" : "s"} (click to expand)
                      </summary>
                      <ul className="mt-2 space-y-1 text-xs text-red-700">
                        {result.errors.slice(0, 50).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
