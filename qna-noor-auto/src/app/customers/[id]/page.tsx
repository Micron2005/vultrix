import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  Button,
  Card,
  CardHeader,
  LinkButton,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { computeTotals, excludeDeclinedJobLines, type AppliedShopFee } from "@/lib/totals";
import { loadAppliedShopFeesForROs } from "@/lib/shopFees";
import {
  formatDate,
  formatMoney,
  fullName,
  vehicleLabel,
} from "@/lib/utils";
import { deleteCustomer } from "../actions";
import { PortalCard } from "./PortalCard";
import { BulkPaymentCard } from "./BulkPaymentCard";

export const dynamic = "force-dynamic";

type ROWithLines = Awaited<ReturnType<typeof loadCustomer>>["repairOrders"][number];

async function loadCustomer(id: string) {
  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      vehicles: { orderBy: { createdAt: "desc" } },
      repairOrders: {
        orderBy: { openedAt: "desc" },
        include: {
          vehicle: true,
          jobs: { select: { id: true, approvalStatus: true } },
          laborLines: true,
          partLines: true,
          feeLines: true,
          payments: { select: { amount: true } },
        },
      },
    },
  });
  if (!customer) return null!;
  return customer;
}

function roBalance(ro: ROWithLines, shopFees: AppliedShopFee[]) {
  const filtered = excludeDeclinedJobLines(ro);
  const { total } = computeTotals({ ...filtered, shopFees });
  const paid = ro.payments.reduce((s, p) => s + p.amount, 0);
  return { total: Math.round(total * 100) / 100, paid: Math.round(paid * 100) / 100, balance: Math.round(Math.max(0, total - paid) * 100) / 100 };
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await loadCustomer(id);
  if (!customer) notFound();

  const shopFeesByRO = await loadAppliedShopFeesForROs(
    customer.repairOrders.map((ro) => {
      const filtered = excludeDeclinedJobLines(ro);
      const t = computeTotals(filtered);
      return { id: ro.id, partsSubtotal: t.partsSubtotal, laborSubtotal: t.laborSubtotal };
    }),
  );

  // Compute balances for each RO
  const roData = customer.repairOrders.map((ro) => {
    const shopFees = shopFeesByRO.get(ro.id) ?? [];
    const { total, paid, balance } = roBalance(ro, shopFees);
    return { ro, total, paid, balance };
  });

  // Split into categories
  const openInvoices = roData.filter(
    (d) => d.balance > 0 && (d.ro.status === "INVOICED" || d.ro.status === "COMPLETED"),
  );
  const openROs = roData.filter(
    (d) =>
      d.ro.status === "ESTIMATE" || d.ro.status === "IN_PROGRESS",
  );
  const paidROs = roData.filter(
    (d) => d.ro.status === "PAID",
  );
  const cancelledROs = roData.filter(
    (d) => d.ro.status === "CANCELLED",
  );

  const totalOwed = openInvoices.reduce((s, d) => s + d.balance, 0);

  // Data for the bulk payment client component
  const invoicesForPayment = openInvoices.map((d) => ({
    roId: d.ro.id,
    roNumber: d.ro.roNumber,
    vehicle: vehicleLabel(d.ro.vehicle),
    total: d.total,
    paid: d.paid,
    balance: d.balance,
  }));

  const deleteAction = deleteCustomer.bind(null, customer.id);

  return (
    <>
      <PageHeader
        title={fullName(customer)}
        description={[
          customer.phone,
          customer.email,
          customer.city && customer.state
            ? `${customer.city}, ${customer.state}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <LinkButton
              href={`/customers/${customer.id}/edit`}
              variant="secondary"
            >
              Edit
            </LinkButton>
            <a
              href={`/customers/${customer.id}/history`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Print history
            </a>
            <LinkButton
              href={`/vehicles/new?customerId=${customer.id}`}
              variant="secondary"
            >
              + Vehicle
            </LinkButton>
            <LinkButton
              href={`/appointments/new?customerId=${customer.id}`}
              variant="secondary"
            >
              + Schedule
            </LinkButton>
            <LinkButton href={`/repair-orders/new?customerId=${customer.id}`}>
              + Repair Order
            </LinkButton>
          </>
        }
      />

      {/* Contact info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-4 text-sm lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 text-zinc-700">
            <Detail label="Phone" value={customer.phone} />
            <Detail label="Alt phone" value={customer.altPhone} />
            <Detail label="Email" value={customer.email} />
            <Detail label="Company" value={customer.companyName} />
            <Detail
              label="Address"
              value={[
                customer.street,
                [customer.city, customer.state].filter(Boolean).join(", "),
                customer.zip,
              ]
                .filter(Boolean)
                .join(" · ") || null}
              full
            />
            {customer.notes && (
              <Detail label="Notes" value={customer.notes} full />
            )}
          </div>
        </Card>

        {/* Total Owed summary */}
        <Card className="p-4 text-sm">
          <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-1">
            Total Owed
          </div>
          <div className={`text-3xl font-bold ${totalOwed > 0 ? "text-red-600" : "text-green-600"}`}>
            {formatMoney(totalOwed)}
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            {openInvoices.length} open invoice{openInvoices.length !== 1 ? "s" : ""}
            {" · "}
            {openROs.length} open RO{openROs.length !== 1 ? "s" : ""}
          </div>
        </Card>
      </div>

      <PortalCard customerId={customer.id} token={customer.portalToken} />

      {/* Bulk Payment */}
      {openInvoices.length > 0 && (
        <BulkPaymentCard
          customerId={customer.id}
          invoices={invoicesForPayment}
          totalOwed={totalOwed}
        />
      )}

      {/* Open Invoices */}
      <ROTable
        title={`Open Invoices (${openInvoices.length})`}
        items={openInvoices}
        showBalance
      />

      {/* Open Repair Orders */}
      <ROTable
        title={`Open Repair Orders (${openROs.length})`}
        items={openROs}
      />

      {/* Paid */}
      <ROTable
        title={`Paid (${paidROs.length})`}
        items={paidROs}
      />

      {/* Cancelled */}
      {cancelledROs.length > 0 && (
        <ROTable
          title={`Cancelled (${cancelledROs.length})`}
          items={cancelledROs}
        />
      )}

      {/* Vehicles — last */}
      <Card className="mb-4">
        <CardHeader title={`Vehicles (${customer.vehicles.length})`}>
          <LinkButton
            href={`/vehicles/new?customerId=${customer.id}`}
            variant="ghost"
            size="sm"
          >
            + Add vehicle
          </LinkButton>
        </CardHeader>
        {customer.vehicles.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500 text-center">
            No vehicles on file yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium">Vehicle</th>
                <th className="px-4 py-2 font-medium">VIN</th>
                <th className="px-4 py-2 font-medium">Plate</th>
                <th className="px-4 py-2 font-medium text-right">Mileage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {customer.vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/vehicles/${v.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {vehicleLabel(v)}
                    </Link>
                    {v.color && (
                      <span className="ml-2 text-xs text-zinc-500">
                        {v.color}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-600">
                    {v.vin ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">
                    {v.licensePlate ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-600">
                    {v.mileage?.toLocaleString() ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <form action={deleteAction} className="mt-10">
        <Button
          type="submit"
          variant="danger"
          size="sm"
        >
          Delete customer
        </Button>
        <p className="mt-1 text-xs text-zinc-500">
          Warning: this also deletes all vehicles and repair orders for this
          customer.
        </p>
      </form>
    </>
  );
}

function ROTable({
  title,
  items,
  showBalance,
}: {
  title: string;
  items: { ro: ROWithLines; total: number; paid: number; balance: number }[];
  showBalance?: boolean;
}) {
  return (
    <Card className="mb-4">
      <CardHeader title={title}>
        <span />
      </CardHeader>
      {items.length === 0 ? (
        <div className="p-6 text-sm text-zinc-500 text-center">
          None.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2 font-medium">RO #</th>
              <th className="px-4 py-2 font-medium">Vehicle</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Opened</th>
              <th className="px-4 py-2 font-medium text-right">Total</th>
              {showBalance && (
                <>
                  <th className="px-4 py-2 font-medium text-right">Paid</th>
                  <th className="px-4 py-2 font-medium text-right">Balance</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {items.map(({ ro, total, paid, balance }) => (
              <tr key={ro.id} className="hover:bg-zinc-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/repair-orders/${ro.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    #{ro.roNumber}
                  </Link>
                </td>
                <td className="px-4 py-2">{vehicleLabel(ro.vehicle)}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={ro.status} />
                </td>
                <td className="px-4 py-2 text-zinc-500">
                  {formatDate(ro.openedAt)}
                </td>
                <td className="px-4 py-2 text-right">
                  {formatMoney(total)}
                </td>
                {showBalance && (
                  <>
                    <td className="px-4 py-2 text-right text-zinc-500">
                      {formatMoney(paid)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-red-600">
                      {formatMoney(balance)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function Detail({
  label,
  value,
  full,
}: {
  label: string;
  value: string | null | undefined;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
        {label}
      </div>
      <div className="mt-1">{value ?? "—"}</div>
    </div>
  );
}
