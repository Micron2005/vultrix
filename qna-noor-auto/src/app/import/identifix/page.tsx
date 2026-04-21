import { Card, CardHeader, PageHeader } from "@/components/ui";
import { IdentifixImportClient } from "./IdentifixImportClient";

export default function IdentifixImportPage() {
  return (
    <>
      <PageHeader
        title="Import from Identifix Shop Management"
        description="Import customers (A), vehicles (B), and invoice history (C) from Identifix's multi-file CSV export."
      />
      <Card className="mb-4">
        <CardHeader title="How this works" />
        <div className="p-4 text-sm text-zinc-700 space-y-2">
          <p>
            Identifix Shop Management exports customers and vehicles as{" "}
            <strong>separate files</strong> linked by a <code>CustomerId</code>{" "}
            field. Use this page (not the generic importer) so names, phones,
            and vehicles all stay linked.
          </p>
          <ul className="list-disc ml-5 space-y-1 text-zinc-600">
            <li>
              <strong>A.csv</strong> — one row per customer. Prefix, FirstName,
              LastName, Phone, Email, Address, IsCompany, Id, …
            </li>
            <li>
              <strong>B.csv</strong> — one row per vehicle. VIN, Plate, Year,
              Make, Model, CustomerId (links to A.Id), Id, …
            </li>
            <li>
              <strong>C.csv (optional)</strong> — invoice history in
              multi-row format. Matched to vehicles by VIN. Imported as closed
              repair orders.
            </li>
          </ul>
          <p>
            Each record is tagged with its Identifix <code>Id</code>. Re-running
            the import <strong>updates</strong> existing records instead of
            duplicating them.
          </p>
        </div>
      </Card>
      <IdentifixImportClient />
    </>
  );
}
