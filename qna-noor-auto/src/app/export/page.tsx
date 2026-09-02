import { db } from "@/lib/db";
import { getCurrentUser, requireOrgId } from "@/lib/session";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { enabledFeatureSet } from "@/lib/features";

export const dynamic = "force-dynamic";

function dateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

export default async function ExportPage() {
  const orgId = await requireOrgId();
  const user = await getCurrentUser();
  const features = enabledFeatureSet(user ?? {});
  const hasInvoices = features.has("invoices");
  const hasCustomers = features.has("customers");
  const hasVehicles = features.has("vehicles");
  const hasRepairOrders =
    features.has("repair_orders") || features.has("invoices");
  const hasTechnicians = features.has("technicians");
  const hasCannedJobs = features.has("presets");
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
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
    db.customer.count({ where: { orgId } }),
    db.vehicle.count({ where: { orgId } }),
    db.repairOrder.count({ where: { orgId } }),
    db.payment.count({ where: { orgId } }),
    db.part.count({ where: { orgId } }),
    db.appointment.count({ where: { orgId } }),
    db.repairNote.count({ where: { orgId } }),
    db.technician.count({ where: { orgId } }),
    db.expense.count({ where: { orgId } }),
    db.cannedJob.count({ where: { orgId } }),
  ]);

  const rows: { label: string; value: number }[] = [
    ...(hasCustomers ? [{ label: "Customers", value: customers }] : []),
    ...(hasVehicles ? [{ label: "Vehicles", value: vehicles }] : []),
    ...(hasRepairOrders
      ? [{ label: "Repair orders", value: repairOrders }]
      : []),
    { label: "Payments", value: payments },
    { label: "Inventory parts", value: parts },
    { label: "Appointments", value: appointments },
    { label: "Knowledge notes", value: notes },
    ...(hasTechnicians ? [{ label: "Technicians", value: technicians }] : []),
    { label: "Expenses", value: expenses },
    ...(hasCannedJobs
      ? [{ label: "Canned jobs (presets)", value: cannedJobs }]
      : []),
  ];
  const exportTableNames = [
    hasCustomers ? "customers" : null,
    hasVehicles ? "vehicles" : null,
    hasRepairOrders ? "repair orders" : null,
    "labor lines",
    "part lines",
    "payments",
    "parts",
    "stock moves",
    "appointments",
    "notes",
    hasTechnicians ? "technicians" : null,
    "expenses",
    hasCannedJobs ? "canned jobs" : null,
    "shop settings",
  ].filter((name): name is string => name !== null);

  return (
    <>
      <PageHeader
        title="Export"
        description="Download a full copy of your data as one ZIP of CSVs."
      />

      <Card className="mb-4">
        <CardHeader title="Tax export" />
        <div className="space-y-4 p-4">
          <div className="text-sm text-zinc-700">
            Everything your accountant needs for this period, in a simple ZIP
            of CSV files.
          </div>
          <form
            action="/export/tax/download"
            method="get"
            className="flex flex-wrap items-end gap-3"
          >
            <label className="text-sm text-zinc-700">
              <span className="mb-1 block text-xs font-medium text-zinc-500">
                From
              </span>
              <input
                type="date"
                name="from"
                defaultValue={dateInputValue(yearStart)}
                className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
              />
            </label>
            <label className="text-sm text-zinc-700">
              <span className="mb-1 block text-xs font-medium text-zinc-500">
                To
              </span>
              <input
                type="date"
                name="to"
                defaultValue={dateInputValue(now)}
                className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Download tax export (.zip)
            </button>
          </form>
          <div className="space-y-1 text-xs text-zinc-500">
            <p>
              Income and expenses use cash basis dates. For invoicing accounts,
              sales tax is tax billed on invoices dated in the period — not tax
              collected.
            </p>
            <p>
              This ZIP contains{" "}
              {hasInvoices
                ? "income-payments.csv, sales-tax-by-invoice.csv, expenses.csv, and summary.csv."
                : "income.csv, expenses.csv, and summary.csv."}
            </p>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader title="Download everything" />
        <div className="p-4 space-y-4">
          <div className="text-sm text-zinc-700">
            A ZIP file with one CSV per table ({exportTableNames.join(", ")}).
            Open any CSV in Excel, Google Sheets, or Numbers.
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
            This is a snapshot export, not a backup.
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
