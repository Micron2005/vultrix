"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardHeader, Field, Select } from "@/components/ui";
import {
  parseCsvHeaders,
  runCalendarImport,
  runMoneyImport,
} from "./actions";
import {
  CALENDAR_IMPORT_FIELDS,
  MONEY_IMPORT_FIELDS,
  type MappedImportField,
} from "./fields";
import {
  classifyMoneyRow,
  parseAmount,
  parseFlexibleDate,
  parseFlexibleTime,
} from "@/lib/importParse";

type ImportType = "money" | "calendar";
type Row = Record<string, string>;
type Result =
  | {
      incomeCreated: number;
      expensesCreated: number;
      duplicates: number;
      skipped: number;
      errors: string[];
    }
  | {
      eventsCreated: number;
      duplicates: number;
      skipped: number;
      errors: string[];
    };

function value(row: Row, map: Record<string, string>, key: string): string {
  return row[map[key] ?? ""]?.trim() ?? "";
}

function autoMap(headers: string[], fields: MappedImportField[]) {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  for (const field of fields) {
    const match = headers.find(
      (header) =>
        !used.has(header) && field.hints.some((hint) => hint.test(header)),
    );
    if (match) {
      map[field.key] = match;
      used.add(match);
    }
  }
  return map;
}

function moneyPreview(row: Row, map: Record<string, string>) {
  const kind = classifyMoneyRow({
    amount: parseAmount(value(row, map, "amount")),
    debit: parseAmount(value(row, map, "debit")),
    credit: parseAmount(value(row, map, "credit")),
    type: value(row, map, "type"),
  });
  const amount = kind ? `$${kind.amount.toFixed(2)}` : "Skipped";
  return {
    date: parseFlexibleDate(value(row, map, "date")) ?? "Invalid date",
    kind: kind?.kind ?? "—",
    amount,
    description: value(row, map, "description") || "—",
  };
}

function calendarPreview(row: Row, map: Record<string, string>) {
  const date = parseFlexibleDate(value(row, map, "startDate"));
  const rawTime = value(row, map, "startTime");
  const startTime = parseFlexibleTime(rawTime);
  const allDayValue = value(row, map, "allDay").toLowerCase();
  const allDay = allDayValue
    ? /^(1|true|yes|y|on|all\s*day)$/i.test(allDayValue)
    : !rawTime;
  return {
    title: value(row, map, "title") || "Untitled",
    date: date ?? "Invalid date",
    time: allDay ? "All day" : startTime ?? (rawTime ? "Invalid time" : "09:00"),
  };
}

export function MappedImportClient({ type }: { type: ImportType }) {
  const fields = type === "money" ? MONEY_IMPORT_FIELDS : CALENDAR_IMPORT_FIELDS;
  const [csvText, setCsvText] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [parsed, setParsed] = useState<{
    headers: string[];
    rowCount: number;
    sample: Row[];
  } | null>(null);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFile(file: File) {
    const text = await file.text();
    setCsvText(text);
    setFilename(file.name);
    setResult(null);
    const info = await parseCsvHeaders(text);
    setParsed(info);
    setColumnMap(autoMap(info.headers, fields));
  }

  function handleRun() {
    if (!csvText) return;
    startTransition(async () => {
      const imported =
        type === "money"
          ? await runMoneyImport(csvText, JSON.stringify(columnMap))
          : await runCalendarImport(csvText, JSON.stringify(columnMap));
      setResult(imported);
    });
  }

  return (
    <>
      <Card className="mb-4">
        <CardHeader title="1. Upload CSV" />
        <div className="min-w-0 p-4 sm:p-6">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
            className="block w-full max-w-full text-sm text-zinc-700 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-900 hover:file:bg-zinc-50"
          />
          {filename && (
            <p className="mt-2 break-all text-sm text-zinc-600">
              Loaded <strong>{filename}</strong>
              {parsed &&
                ` · ${parsed.rowCount} rows · ${parsed.headers.length} columns`}
            </p>
          )}
        </div>
      </Card>

      {parsed && (
        <>
          <Card className="mb-4">
            <CardHeader title="2. Map columns">
              <span className="text-xs text-zinc-500">
                Auto-matched where possible. Unmapped fields are skipped.
              </span>
            </CardHeader>
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-6">
              {fields.map((field) => (
                <Field key={field.key} label={field.label}>
                  <Select
                    value={columnMap[field.key] ?? ""}
                    onChange={(event) =>
                      setColumnMap((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                  >
                    <option value="">— skip —</option>
                    {parsed.headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
          </Card>

          <Card className="mb-4">
            <CardHeader title="3. Preview first rows" />
            <div className="overflow-x-auto p-4">
              {type === "money" ? (
                <table className="w-full min-w-[440px] text-xs">
                  <thead className="bg-zinc-50 text-left text-zinc-600">
                    <tr>
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Kind</th>
                      <th className="px-2 py-2">Amount</th>
                      <th className="px-2 py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {parsed.sample.slice(0, 3).map((row, index) => {
                      const preview = moneyPreview(row, columnMap);
                      return (
                        <tr key={index}>
                          <td className="px-2 py-2">{preview.date}</td>
                          <td className="px-2 py-2 capitalize">{preview.kind}</td>
                          <td className="px-2 py-2">{preview.amount}</td>
                          <td className="max-w-48 truncate px-2 py-2">
                            {preview.description}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[360px] text-xs">
                  <thead className="bg-zinc-50 text-left text-zinc-600">
                    <tr>
                      <th className="px-2 py-2">Title</th>
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {parsed.sample.slice(0, 3).map((row, index) => {
                      const preview = calendarPreview(row, columnMap);
                      return (
                        <tr key={index}>
                          <td className="max-w-48 truncate px-2 py-2">
                            {preview.title}
                          </td>
                          <td className="px-2 py-2">{preview.date}</td>
                          <td className="px-2 py-2">{preview.time}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {parsed.sample.length === 0 && (
                <p className="text-sm text-zinc-500">No preview rows.</p>
              )}
            </div>
          </Card>

          <Card className="mb-4">
            <CardHeader title="4. Run import" />
            <div className="p-4 sm:p-6">
              <Button onClick={handleRun} disabled={isPending || !csvText}>
                {isPending ? "Importing…" : `Import ${parsed.rowCount} rows`}
              </Button>
              {result && (
                <div className="mt-4 space-y-1 text-sm">
                  {type === "money" && "incomeCreated" in result ? (
                    <p className="text-green-700">
                      Created {result.incomeCreated} income and{" "}
                      {result.expensesCreated} expenses.
                    </p>
                  ) : type === "calendar" && "eventsCreated" in result ? (
                    <p className="text-green-700">
                      Created {result.eventsCreated} calendar events.
                    </p>
                  ) : null}
                  {result.duplicates > 0 && (
                    <p className="text-zinc-600">
                      Skipped {result.duplicates} duplicate row
                      {result.duplicates === 1 ? "" : "s"}.
                    </p>
                  )}
                  {result.skipped > 0 && (
                    <p className="text-zinc-600">
                      Skipped {result.skipped} invalid row
                      {result.skipped === 1 ? "" : "s"}.
                    </p>
                  )}
                  {result.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-red-700">
                        {result.errors.length} row error
                        {result.errors.length === 1 ? "" : "s"}
                      </summary>
                      <ul className="mt-2 space-y-1 text-xs text-red-700">
                        {result.errors.slice(0, 50).map((error, index) => (
                          <li key={index}>{error}</li>
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
