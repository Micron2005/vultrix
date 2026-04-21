import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LinkButton, PageHeader } from "@/components/ui";
import { AppointmentForm } from "../../AppointmentForm";
import { updateAppointment } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appt = await db.appointment.findUnique({ where: { id } });
  if (!appt) notFound();

  const customers = await db.customer.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { vehicles: { orderBy: { createdAt: "asc" } } },
  });

  const action = updateAppointment.bind(null, appt.id);

  return (
    <>
      <PageHeader
        title="Edit appointment"
        actions={
          <LinkButton href={`/appointments/${appt.id}`} variant="secondary">
            Cancel
          </LinkButton>
        }
      />
      <div className="max-w-3xl">
        <AppointmentForm
          action={action}
          appointment={appt}
          customers={customers}
          submitLabel="Save changes"
        />
      </div>
    </>
  );
}
