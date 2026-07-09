"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardHeader, Field, Select, Textarea } from "@/components/ui";
import { parsePartsCsv, runPartsImport } from "./actions";
import {
  PART_FIELDS,
  PART_HEADER_HINTS,
  type PartColumnMap,
} from "./fields";

type Parsed = {
  headers: string[];
  rowCount: number;
  sample: Record<string, string>[];
};

function autoMap(headers: string[]): PartColumnMap {
  const map: PartColumnMap = {};
  const used = new Set<string>();
  for (const f of PART_FIELDS) {
    const hints = PART_HEADER_HINTS[f.key];
    const match = headers.find(
      (h) => !used.has(h) && hints.some((rx) => rx.test(h)),
    );
    if (match) {
      map[f.key] = match;
      used.add(match);
    }
  }
  return map;
}

export function ImportPartsClient() {
  const [csvText, setCsvText] = useState<string>("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [columnMap, setColumnMap] = useState<PartColumnMap>({});
  const [filename, setFilename] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  async function parseText(text: string) {
    setResult(null);
    if (!text.trim()) {
      setParsed(null);
      return;
    }
    const info = await parsePartsCsv(text);
    setParsed(info);
    setColumnMap(autoMap(info.headers));
  }

  async function handleFile(f: File) {
    const text = await f.text();
    setFilename(f.name);
    setCsvText(text);
    await parseText(text);
  }

  function handleRun() {
    if (!csvText.trim() || !columnMap.name) return;
    startTransition(async () => {
      const r = await runPartsImport(csvText, JSON.stringify(columnMap));
      setResult(r);
    });
  }

  const mappedFields = PART_FIELDS.filter((f) => columnMap[f.key]);

  return (
    <>
      <Card className="mb-4">
        <CardHeader title="1. Paste your parts (or upload a CSV)">
          <span className="text-xs text-zinc-500">
            Copy rows from Excel / Google Sheets and paste — a header row helps
            auto-matching.
          </span>
        </CardHeader>
        <div className="p-6 space-y-3">
          <Textarea
            rows={8}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            onBlur={(e) => parseText(e.target.value)}
            placeholder={
              "name\tpart number\tcategory\tunit\tlocation\tqty\tcost\tprice\n" +
              "Oil filter PH7317\tPH7317\tFilters\teach\tShelf B3\t24\t3.10\t9.99\n" +
              "Oil filter PH3614\tPH3614\tFilters\teach\tShelf B3\t18\t3.40\t10.99"
            }
            className="font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => parseText(csvText)}
            >
              Preview
            </Button>
            <span className="text-xs text-zinc-500">or</span>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="text-sm"
            />
            {filename && (
              <span className="text-xs text-zinc-600">Loaded {filename}</span>
            )}
          </div>
          {parsed && (
            <p className="text-sm text-zinc-600">
              {parsed.rowCount} row{parsed.rowCount === 1 ? "" : "s"} ·{" "}
              {parsed.headers.length} column
              {parsed.headers.length === 1 ? "" : "s"} detected
            </p>
          )}
        </div>
      </Card>

      {parsed && (
        <>
          <Card className="mb-4">
            <CardHeader title="2. Map columns">
              <span className="text-xs text-zinc-500">
                Auto-matched where possible. Name is required.
              </span>
            </CardHeader>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {PART_FIELDS.map((f) => (
                <Field
                  key={f.key}
                  label={f.required ? `${f.label} *` : f.label}
                >
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
            {!columnMap.name && (
              <div className="px-6 pb-4 text-sm text-red-700">
                Pick which column holds the part name before importing.
              </div>
            )}
          </Card>

          <Card className="mb-4">
            <CardHeader title="3. Preview" />
            <div className="p-4 overflow-x-auto">
              {mappedFields.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Map at least one column to preview.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50">
                    <tr>
                      {mappedFields.map((f) => (
                        <th
                          key={f.key}
                          className="px-2 py-1 text-left font-medium"
                        >
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {parsed.sample.map((row, i) => (
                      <tr key={i}>
                        {mappedFields.map((f) => (
                          <td key={f.key} className="px-2 py-1">
                            {row[columnMap[f.key]!] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          <Card className="mb-4">
            <CardHeader title="4. Import">
              <span className="text-xs text-zinc-500">
                Existing parts (matched by part #) are updated; the rest are
                created.
              </span>
            </CardHeader>
            <div className="p-6">
              <Button
                onClick={handleRun}
                disabled={isPending || !columnMap.name}
              >
                {isPending
                  ? "Importing…"
                  : `Import ${parsed.rowCount} row${parsed.rowCount === 1 ? "" : "s"}`}
              </Button>
              {result && (
                <div className="mt-4 text-sm space-y-1">
                  <p className="text-green-700">
                    Created {result.created}, updated {result.updated} part
                    {result.created + result.updated === 1 ? "" : "s"}.
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
