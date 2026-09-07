"use client";

import Papa from "papaparse";

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function rowsFromTable(table: HTMLTableElement): string[][] {
  const rows: string[][] = [];
  const header = Array.from(table.querySelectorAll("thead th")).map((cell) =>
    cleanText(cell.textContent),
  );
  if (header.length > 0) rows.push(header);

  for (const row of table.querySelectorAll("tbody tr")) {
    rows.push(
      Array.from(row.querySelectorAll("th,td")).map((cell) =>
        cleanText(cell.textContent),
      ),
    );
  }
  for (const row of table.querySelectorAll("tfoot tr")) {
    rows.push(
      Array.from(row.querySelectorAll("th,td")).map((cell) =>
        cleanText(cell.textContent),
      ),
    );
  }
  return rows;
}

export function exportReportCsv(fileName: string) {
  const report = document.querySelector("[data-report]");
  if (!report) return;

  const sections: string[][][] = [];
  const summary: string[][] = [["Summary"]];
  for (const stat of report.querySelectorAll("[data-report-stat]")) {
    const label = cleanText(
      stat.querySelector("[data-report-stat-label]")?.textContent,
    );
    const value = cleanText(
      stat.querySelector("[data-report-stat-value]")?.textContent,
    );
    if (label || value) summary.push([label, value]);
    for (const subline of stat.querySelectorAll(
      "[data-report-stat-subline]",
    )) {
      const text = cleanText(subline.textContent);
      if (text) summary.push([`${label} · ${text}`]);
    }
  }
  sections.push(summary);

  for (const table of report.querySelectorAll("table")) {
    const title =
      cleanText(table.getAttribute("data-export-title")) ||
      cleanText(table.closest("[data-card]")?.querySelector("h2,h3")?.textContent) ||
      "Table";
    sections.push([[title], ...rowsFromTable(table)]);
  }

  const rows = sections.flatMap((section, index) =>
    index === sections.length - 1 ? section : [...section, []],
  );
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ReportActions({ fileName }: { fileName: string }) {
  return (
    <span className="no-print inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
      >
        Print
      </button>
      <button
        type="button"
        onClick={() => exportReportCsv(fileName)}
        className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
      >
        Download CSV
      </button>
    </span>
  );
}
