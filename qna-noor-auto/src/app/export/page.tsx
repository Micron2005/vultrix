import { db } from "@/lib/db";
import { Card, CardHeader, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const [
    customers,
    vehicles,
    repairOrders,
    payments,
    parts,
    appointments,
    notes,
    technicians,
    expenses,
    cannedJobs,
  ] = await Promise.all([
    db.customer.count(),
    db.vehicle.count(),
    db.repairOrder.count(),
    db.payment.count(),
    db.part.count(),
    db.appointment.count(),
    db.repairNote.count(),
    db.technician.count(),
    db.expense.count(),
    db.cannedJob.count(),
  ]);

  const rows: { label: string; value: number }[] = [
    { label: "Customers", value: customers },
    { label: "Vehicles", value: vehicles },
    { label: "Repair orders", value: repairOrders },
    { label: "Payments", value: payments },
    { label: "Inventory parts", value: parts },
    { label: "Appointments", value: appointments },
    { label: "Knowledge notes", value: notes },
    { label: "Technicians", value: technicians },
    { label: "Expenses", value: expenses },
    { label: "Canned jobs (presets)", value: cannedJobs },
  ];

  return (
    <>
      <PageHeader
        title="Export"
        description="Download a full copy of your shop data as one ZIP of CSVs."
      />

      <Card className="mb-4">
        <CardHeader title="Download everything" />
        <div className="p-4 space-y-4">
          <div className="text-sm text-zinc-700">
            A ZIP file with one CSV per table (customers, vehicles, repair
            orders, labor lines, part lines, payments, parts, stock moves,
            appointments, notes, technicians, expenses, canned jobs, shop
            settings). Open any CSV in Excel, Google Sheets, or Numbers.
          </div>
          <div>
            <a
              href="/export/download"
              className="inline-flex items-center rounded-md bg-zinc-900 text-white px-4 h-10 text-sm font-medium hover:bg-zinc-800"
            >
              Download all data (.zip)
            </a>
          </div>
          <div className="text-xs text-zinc-500">
            This is a snapshot export, not a backup. For a complete backup,
            also copy the SQLite database file at{" "}
            <code className="font-mono text-[11px] px-1 py-0.5 bg-zinc-100 rounded">
              prisma/dev.db
            </code>
            .
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="What's in the export" />
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2 font-medium">Sheet</th>
              <th className="px-4 py-2 font-medium text-right">Rows</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="px-4 py-2 text-zinc-700">{r.label}</td>
                <td className="px-4 py-2 text-right font-medium text-zinc-900 tabular-nums">
                  {r.value.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
