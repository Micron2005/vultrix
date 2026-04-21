import { Card, CardHeader, PageHeader } from "@/components/ui";
import { ImportClient } from "./ImportClient";

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Import CSV"
        description="Migrate customers and vehicles from Identifix Shop Management (or any CSV export)"
      />
      <Card className="mb-4">
        <CardHeader title="How to export from Identifix Shop Management" />
        <div className="p-4 text-sm text-zinc-700 space-y-2">
          <p>
            Identifix Shop Management (like most shop management systems) supports exporting
            customers and vehicles to CSV. The exact menu varies by version — common paths:
          </p>
          <ul className="list-disc ml-5 space-y-1 text-zinc-600">
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
            If you can&rsquo;t find an export option, contact Identifix support and ask for a
            CSV of your customer + vehicle data. They&rsquo;re required to give you your own
            data.
          </p>
          <p>
            Once you have the CSV, upload it below. You&rsquo;ll then map each CSV column to a
            field in this system (e.g. their &ldquo;Cust First Name&rdquo; column → our{" "}
            <code className="bg-zinc-100 px-1 rounded text-xs">First name</code> field).
          </p>
        </div>
      </Card>
      <ImportClient />
    </>
  );
}
