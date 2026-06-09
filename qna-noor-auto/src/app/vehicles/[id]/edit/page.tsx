import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { VehicleForm } from "../../VehicleForm";
import { updateVehicle } from "../../actions";
import { vehicleLabel } from "@/lib/utils";

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const orgId = await requireOrgId();
  const { id } = await params;
  const vehicle = await db.vehicle.findFirst({ where: { id, orgId } });
  if (!vehicle) notFound();

  const action = updateVehicle.bind(null, vehicle.id);

  return (
    <>
      <PageHeader title={`Edit ${vehicleLabel(vehicle)}`} />
      <Card className="p-6">
        <VehicleForm action={action} vehicle={vehicle} submitLabel="Save changes" />
      </Card>
    </>
  );
}
