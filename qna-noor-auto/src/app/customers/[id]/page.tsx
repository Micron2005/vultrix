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
import { computeTotals } from "@/lib/totals";
import {
  formatDate,
  formatMoney,
  fullName,
  vehicleLabel,
} from "@/lib/utils";
import { deleteCustomer } from "../actions";
import { PortalCard } from "./PortalCard";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      vehicles: { orderBy: { createdAt: "desc" } },
      repairOrders: {
        orderBy: { openedAt: "desc" },
        include: {
          vehicle: true,
          laborLines: true,
          partLines: true,
          feeLines: true,
        },
      },
    },
  });
  if (!customer) notFound();

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
      </div>

      <PortalCard customerId={customer.id} token={customer.portalToken} />

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

      <Card className="mb-4">
        <CardHeader title={`Repair Orders (${customer.repairOrders.length})`}>
          <LinkButton
            href={`/repair-orders/new?customerId=${customer.id}`}
            variant="ghost"
            size="sm"
          >
            + New RO
          </LinkButton>
        </CardHeader>
        {customer.repairOrders.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500 text-center">
            No repair orders for this customer yet.
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
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {customer.repairOrders.map((ro) => {
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
                  </tr>
                );
              })}
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
