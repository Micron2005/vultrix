import Link from "next/link";
import { db } from "@/lib/db";
import {
  Card,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
  Select,
  StatusBadge,
} from "@/components/ui";
import { computeTotals } from "@/lib/totals";
import {
  formatDate,
  formatMoney,
  fullName,
  vehicleLabel,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUSES = [
  "ESTIMATE",
  "IN_PROGRESS",
  "COMPLETED",
  "INVOICED",
  "PAID",
  "CANCELLED",
];

export default async function RepairOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const query = q?.trim() ?? "";
  const statusFilter = status?.trim();

  const ros = await db.repairOrder.findMany({
    where: {
      ...(statusFilter && STATUSES.includes(statusFilter)
        ? { status: statusFilter }
        : {}),
      ...(query
        ? {
            OR: [
              { customer: { lastName: { contains: query } } },
              { customer: { firstName: { contains: query } } },
              { vehicle: { vin: { contains: query } } },
              { vehicle: { licensePlate: { contains: query } } },
              { complaint: { contains: query } },
              ...(parseInt(query, 10)
                ? [{ roNumber: parseInt(query, 10) }]
                : []),
            ],
          }
        : {}),
    },
    include: {
      customer: true,
      vehicle: true,
      laborLines: true,
      partLines: true,
    },
    orderBy: { openedAt: "desc" },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Repair Orders"
        description="All repair orders across the shop"
        actions={<LinkButton href="/repair-orders/new">New RO</LinkButton>}
      />

      <form className="mb-4 flex gap-2 max-w-xl" method="GET">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Search RO #, customer, VIN, plate, complaint…"
        />
        <Select name="status" defaultValue={statusFilter ?? ""}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </Select>
      </form>

      {ros.length === 0 ? (
        <EmptyState
          title={
            query || statusFilter
              ? "No ROs matched your filters"
              : "No repair orders yet"
          }
          description={
            query || statusFilter
              ? undefined
              : "Create your first repair order to get started."
          }
          action={<LinkButton href="/repair-orders/new">New RO</LinkButton>}
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium">RO #</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Vehicle</th>
                <th className="px-4 py-2 font-medium">Complaint</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Opened</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {ros.map((ro) => {
                const { total } = computeTotals(ro);
                return (
                  <tr key={ro.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/repair-orders/${ro.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        #{ro.roNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{fullName(ro.customer)}</td>
                    <td className="px-4 py-2">{vehicleLabel(ro.vehicle)}</td>
                    <td className="px-4 py-2 text-zinc-600 max-w-xs truncate">
                      {ro.complaint ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={ro.status} />
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
                      {formatDate(ro.openedAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatMoney(total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
