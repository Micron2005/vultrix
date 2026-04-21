import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { LinkButton, PageHeader } from "@/components/ui";
import { AppointmentForm } from "../AppointmentForm";
import { createAppointment } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; vehicleId?: string }>;
}) {
  const { customerId, vehicleId } = await searchParams;

  const customers = await db.customer.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { vehicles: { orderBy: { createdAt: "asc" } } },
  });

  if (customers.length === 0) {
    redirect("/customers/new?reason=appointment");
  }

  return (
    <>
      <PageHeader
        title="New appointment"
        actions={
          <LinkButton href="/appointments" variant="secondary">
            Cancel
          </LinkButton>
        }
      />
      <div className="max-w-3xl">
        <AppointmentForm
          action={createAppointment}
          customers={customers}
          submitLabel="Schedule"
          defaultCustomerId={customerId}
          defaultVehicleId={vehicleId}
        />
      </div>
    </>
  );
}
