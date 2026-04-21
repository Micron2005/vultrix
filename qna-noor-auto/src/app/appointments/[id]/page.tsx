import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Button, Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";
import { fullName, formatDateTime, vehicleLabel } from "@/lib/utils";
import {
  deleteAppointment,
  setAppointmentStatus,
  startRoFromAppointment,
} from "../actions";
import { prettyStatus } from "../AppointmentForm";
import { statusBadgeClass } from "../status";
import { ShareLinkPanel } from "@/app/repair-orders/[id]/ShareLinkPanel";
import {
  generateReminderToken,
  regenerateReminderToken,
  revokeReminderToken,
} from "../reminders";

export const dynamic = "force-dynamic";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appt = await db.appointment.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: true,
      repairOrder: { select: { id: true, roNumber: true, status: true } },
    },
  });
  if (!appt) notFound();

  const del = deleteAppointment.bind(null, appt.id);
  const confirm = setAppointmentStatus.bind(null, appt.id, "CONFIRMED");
  const cancel = setAppointmentStatus.bind(null, appt.id, "CANCELLED");
  const noShow = setAppointmentStatus.bind(null, appt.id, "NO_SHOW");
  const complete = setAppointmentStatus.bind(null, appt.id, "COMPLETED");
  const startRo = startRoFromAppointment.bind(null, appt.id);
  const genReminder = generateReminderToken.bind(null, appt.id);
  const regenReminder = regenerateReminderToken.bind(null, appt.id);
  const revokeReminder = revokeReminderToken.bind(null, appt.id);

  const endsAt = new Date(appt.startsAt);
  endsAt.setMinutes(endsAt.getMinutes() + appt.durationMinutes);

  return (
    <>
      <PageHeader
        title={appt.reason}
        description={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={
                "text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded " +
                statusBadgeClass(appt.status)
              }
            >
              {prettyStatus(appt.status)}
            </span>
            <span className="text-zinc-700">
              {formatDateTime(appt.startsAt)}
            </span>
            <span className="text-xs text-zinc-500">
              · {appt.durationMinutes} min · until {timeLabel(endsAt)}
            </span>
          </div>
        }
        actions={
          <>
            <LinkButton href="/appointments" variant="secondary">
              Back
            </LinkButton>
            <LinkButton href={`/appointments/${appt.id}/edit`}>Edit</LinkButton>
          </>
        }
      />

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
              Customer
            </div>
            <Link
              href={`/customers/${appt.customerId}`}
              className="mt-1 block underline"
            >
              {fullName(appt.customer)}
            </Link>
            {appt.customer.phone && (
              <div className="text-xs text-zinc-600">
                {appt.customer.phone}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
              Vehicle
            </div>
            {appt.vehicle ? (
              <Link
                href={`/vehicles/${appt.vehicle.id}`}
                className="mt-1 block underline"
              >
                {vehicleLabel(appt.vehicle)}
                {appt.vehicle.licensePlate && (
                  <span className="text-zinc-500">
                    {" "}
                    · {appt.vehicle.licensePlate}
                  </span>
                )}
              </Link>
            ) : (
              <div className="mt-1 text-zinc-500">— not yet assigned —</div>
            )}
          </div>
        </div>
        {appt.notes && (
          <div className="mt-4 pt-3 border-t border-zinc-200">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
              Notes
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm">
              {appt.notes}
            </div>
          </div>
        )}
        {appt.repairOrder && (
          <div className="mt-4 pt-3 border-t border-zinc-200">
            <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
              Linked repair order
            </div>
            <Link
              href={`/repair-orders/${appt.repairOrder.id}`}
              className="mt-1 block underline text-indigo-700"
            >
              RO #{appt.repairOrder.roNumber} ({appt.repairOrder.status})
            </Link>
          </div>
        )}
      </Card>

      <Card className="p-4 mb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
          Actions
        </div>
        <div className="flex flex-wrap gap-2">
          {appt.status === "SCHEDULED" && (
            <form action={confirm}>
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-blue-600 text-white px-3 h-9 text-sm font-medium hover:bg-blue-700"
              >
                Confirm
              </button>
            </form>
          )}
          {!appt.repairOrderId &&
            appt.status !== "CANCELLED" &&
            appt.status !== "NO_SHOW" && (
              <form action={startRo}>
                <button
                  type="submit"
                  disabled={!appt.vehicleId}
                  className="inline-flex items-center rounded-md bg-green-600 text-white px-3 h-9 text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    appt.vehicleId
                      ? "Customer is here — start the repair order"
                      : "Assign a vehicle first"
                  }
                >
                  Customer arrived → Start RO
                </button>
              </form>
            )}
          {appt.status !== "COMPLETED" && appt.repairOrderId && (
            <form action={complete}>
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-green-700 text-white px-3 h-9 text-sm font-medium hover:bg-green-800"
              >
                Mark appointment complete
              </button>
            </form>
          )}
          {appt.status !== "CANCELLED" && (
            <form action={cancel}>
              <button
                type="submit"
                className="inline-flex items-center rounded-md border border-zinc-300 bg-white text-zinc-700 px-3 h-9 text-sm font-medium hover:bg-zinc-50"
              >
                Cancel
              </button>
            </form>
          )}
          {appt.status !== "NO_SHOW" && !appt.repairOrderId && (
            <form action={noShow}>
              <button
                type="submit"
                className="inline-flex items-center rounded-md border border-zinc-300 bg-white text-zinc-700 px-3 h-9 text-sm font-medium hover:bg-zinc-50"
              >
                No-show
              </button>
            </form>
          )}
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader title="Reminder link">
          <span className="text-xs text-zinc-500 font-normal">
            Customer-safe — text, email, or print as a physical reminder card.
          </span>
        </CardHeader>
        <div className="p-4 space-y-3 text-sm">
          {appt.shareToken ? (
            <>
              <ShareLinkPanel token={appt.shareToken} pathPrefix="/a/" />
              <div className="flex gap-2 pt-1">
                <form action={regenReminder}>
                  <Button type="submit" variant="ghost" size="sm">
                    Regenerate
                  </Button>
                </form>
                <form action={revokeReminder}>
                  <Button type="submit" variant="ghost" size="sm">
                    Revoke link
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <form action={genReminder}>
              <Button type="submit" variant="secondary">
                Generate reminder link
              </Button>
            </form>
          )}
        </div>
      </Card>

      <form action={del}>
        <button
          type="submit"
          className="text-xs text-red-700 hover:underline"
        >
          Delete this appointment
        </button>
      </form>
    </>
  );
}

function timeLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
