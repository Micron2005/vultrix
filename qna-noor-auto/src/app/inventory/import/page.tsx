import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { ImportPartsClient } from "./ImportPartsClient";

export const dynamic = "force-dynamic";

export default function ImportPartsPage() {
  return (
    <>
      <PageHeader
        title="Import parts"
        description="Add many parts at once instead of one at a time — paste from a spreadsheet or upload a CSV."
        actions={
          <Link
            href="/inventory"
            className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium border border-zinc-300 bg-white hover:bg-zinc-50"
          >
            ← Inventory
          </Link>
        }
      />
      <Card className="mb-4 border-blue-300 bg-blue-50">
        <div className="p-4 text-sm text-zinc-800 space-y-1">
          <p className="font-semibold text-blue-900">Quickest way</p>
          <p>
            Open your parts in Excel or Google Sheets, select the rows (include
            the header row), copy, and paste into the box below. Columns like{" "}
            <em>name, part number, category, unit, location, qty, cost, price</em>{" "}
            (and vehicle <em>make / model / year</em> for filters) are matched
            automatically.
          </p>
          <p className="text-zinc-600">
            No spreadsheet? Just type rows in the box — one part per line, tabs
            or commas between fields.
          </p>
        </div>
      </Card>
      <ImportPartsClient />
    </>
  );
}
