import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";
import { vehicleLabel, fullName } from "@/lib/utils";
import { InspectionRunner, type InspectionRunnerData } from "./InspectionRunner";

export const dynamic = "force-dynamic";

export default async function InspectionRunnerPage({
  params,
}: {
  params: Promise<{ id: string; inspectionId: string }>;
}) {
  const user = await requireUser();
  if (user.accountType !== "AUTO_SHOP") notFound();
  const orgId = await requireOrgId();
  const { id, inspectionId } = await params;
  const [inspection, technicians] = await Promise.all([
    db.inspection.findFirst({
      where: { id: inspectionId, orgId, repairOrderId: id },
      include: {
        repairOrder: { include: { vehicle: true, customer: { select: { firstName: true, lastName: true, portalToken: true } } } },
        technician: true,
        items: { orderBy: { sortOrder: "asc" }, include: { photos: { orderBy: { createdAt: "asc" } } } },
      },
    }),
    db.technician.findMany({ where: { orgId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!inspection) notFound();
  const data: InspectionRunnerData = {
    id: inspection.id,
    repairOrderId: inspection.repairOrderId,
    roNumber: inspection.repairOrder.roNumber,
    vehicle: inspection.repairOrder.vehicle ? vehicleLabel(inspection.repairOrder.vehicle) : `RO #${inspection.repairOrder.roNumber}`,
    customerName: fullName(inspection.repairOrder.customer),
    portalToken: inspection.repairOrder.customer.portalToken,
    templateName: inspection.templateName,
    status: inspection.status,
    sentAt: inspection.sentAt?.toISOString() ?? null,
    summary: inspection.summary ?? "",
    technicianId: inspection.technicianId,
    items: inspection.items.map((item) => ({
      id: item.id,
      section: item.section,
      name: item.name,
      rating: item.rating as "GOOD" | "ATTENTION" | "URGENT" | "NA" | null,
      note: item.note ?? "",
      jobId: item.jobId,
      photos: item.photos.map((photo) => ({ id: photo.id, dataUrl: photo.dataUrl })),
    })),
  };
  return <InspectionRunner data={data} technicians={technicians} canDelete={user.role !== "STAFF"} />;
}
