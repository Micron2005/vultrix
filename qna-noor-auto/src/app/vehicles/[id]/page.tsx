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
import { loadAppliedShopFeesForROs } from "@/lib/shopFees";
import { findNotesForVehicle } from "@/lib/notes";
import {
  formatDate,
  formatMoney,
  fullName,
  vehicleLabel,
} from "@/lib/utils";
import { deleteVehicle } from "../actions";
import { RecallsCard } from "./RecallsCard";
import { ServiceRemindersCard } from "@/components/ServiceRemindersCard";
import { computeVehicleReminders } from "@/lib/serviceReminders";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vehicle = await db.vehicle.findUnique({
    where: { id },
    include: {
      customer: true,
      repairOrders: {
        orderBy: { openedAt: "desc" },
        include: { laborLines: true, partLines: true, feeLines: true },
      },
    },
  });
  if (!vehicle) notFound();

  const shopFeesByRO = await loadAppliedShopFeesForROs(
    vehicle.repairOrders.map((ro) => {
      const t = computeTotals(ro);
      return { id: ro.id, partsSubtotal: t.partsSubtotal, laborSubtotal: t.laborSubtotal };
    }),
  );

  const del = deleteVehicle.bind(null, vehicle.id);
  const relevantNotes = await findNotesForVehicle(vehicle);
  const reminders = await computeVehicleReminders(vehicle.id);

  return (
    <>
      <PageHeader
        title={vehicleLabel(vehicle)}
        description={
          <>
            <Link
              href={`/customers/${vehicle.customerId}`}
              className="underline"
            >
              {fullName(vehicle.customer)}
            </Link>
            {vehicle.licensePlate && ` · Plate ${vehicle.licensePlate}`}
            {vehicle.mileage && ` · ${vehicle.mileage.toLocaleString()} mi`}
          </>
        }
        actions={
          <>
            <LinkButton
              href={`/vehicles/${vehicle.id}/edit`}
              variant="secondary"
            >
              Edit
            </LinkButton>
            <LinkButton
              href={`/appointments/new?customerId=${vehicle.customerId}&vehicleId=${vehicle.id}`}
              variant="secondary"
            >
              + Schedule
            </LinkButton>
            <LinkButton href={`/repair-orders/new?vehicleId=${vehicle.id}`}>
              + Repair Order
            </LinkButton>
          </>
        }
      />

      <Card className="p-4 mb-4 text-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Detail label="VIN" value={vehicle.vin} mono />
          <Detail label="Year" value={vehicle.year?.toString() ?? null} />
          <Detail label="Make" value={vehicle.make} />
          <Detail label="Model" value={vehicle.model} />
          <Detail label="Trim" value={vehicle.trim} />
          <Detail label="Engine" value={vehicle.engine} />
          <Detail label="Transmission" value={vehicle.transmission} />
          <Detail label="Drivetrain" value={vehicle.drivetrain} />
          <Detail label="Body style" value={vehicle.bodyStyle} />
          <Detail label="Color" value={vehicle.color} />
          <Detail
            label="Plate"
            value={
              vehicle.licensePlate
                ? `${vehicle.licensePlate}${vehicle.licenseState ? ` (${vehicle.licenseState})` : ""}`
                : null
            }
          />
          <Detail
            label="Mileage"
            value={vehicle.mileage?.toLocaleString() ?? null}
          />
        </div>
        {vehicle.notes && (
          <div className="mt-3 pt-3 border-t border-zinc-200">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
              Notes
            </div>
            <div className="mt-1 whitespace-pre-wrap">{vehicle.notes}</div>
          </div>
        )}
      </Card>

      <RecallsCard
        vehicleId={vehicle.id}
        year={vehicle.year}
        make={vehicle.make}
        model={vehicle.model}
        recallsJson={vehicle.recallsJson}
        recallsFetchedAt={vehicle.recallsFetchedAt}
      />

      {reminders && <ServiceRemindersCard data={reminders} />}

      {relevantNotes.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={`Relevant notes (${relevantNotes.length})`}>
            <LinkButton href="/notes" variant="ghost" size="sm">
              All notes →
            </LinkButton>
          </CardHeader>
          <ul className="divide-y divide-zinc-200">
            {relevantNotes.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/notes/${n.id}`}
                  className="block px-4 py-3 hover:bg-zinc-50"
                >
                  <div className="text-sm font-medium text-zinc-900">
                    {n.title}
                  </div>
                  {n.symptom && (
                    <div className="text-xs text-zinc-500 line-clamp-1 mt-0.5">
                      {n.symptom}
                    </div>
                  )}
                  {n.tags && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {n.tags.split(",").map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-zinc-100 text-zinc-700 text-xs px-2 py-0.5"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader title={`Repair history (${vehicle.repairOrders.length})`}>
          <LinkButton
            href={`/repair-orders/new?vehicleId=${vehicle.id}`}
            variant="ghost"
            size="sm"
          >
            + New RO
          </LinkButton>
        </CardHeader>
        {vehicle.repairOrders.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500 text-center">
            No repair history yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium">RO #</th>
                <th className="px-4 py-2 font-medium">Complaint</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Opened</th>
                <th className="px-4 py-2 font-medium text-right">Mileage</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {vehicle.repairOrders.map((ro) => {
                const shopFees = shopFeesByRO.get(ro.id) ?? [];
                const { total } = computeTotals({ ...ro, shopFees });
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
                    <td className="px-4 py-2 text-zinc-600 max-w-xs truncate">
                      {ro.complaint ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={ro.status} />
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
                      {formatDate(ro.openedAt)}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-600">
                      {ro.mileageIn?.toLocaleString() ?? "—"}
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

      <form action={del} className="mt-10">
        <Button type="submit" variant="danger" size="sm">
          Delete vehicle
        </Button>
        <p className="mt-1 text-xs text-zinc-500">
          This also deletes all repair orders for this vehicle.
        </p>
      </form>
    </>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
        {label}
      </div>
      <div className={mono ? "mt-1 font-mono text-xs" : "mt-1"}>
        {value ?? "—"}
      </div>
    </div>
  );
}
