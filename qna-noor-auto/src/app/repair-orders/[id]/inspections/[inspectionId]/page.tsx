import { notFound } from "next/navigation";
import { requireOrgId, requireUser } from "@/lib/session";
import {
  loadInspectionRunnerData,
  loadTechnicians,
} from "@/lib/inspections";
import {
  addInspectionPhotos,
  addJobFromInspectionItem,
  completeInspection,
  deleteInspection,
  deleteInspectionPhoto,
  noteInspectionItem,
  rateInspectionItem,
  reopenInspection,
  sendInspectionToCustomer,
  setInspectionSummary,
  setInspectionTechnician,
} from "../../inspection-actions";
import { InspectionRunner } from "./InspectionRunner";

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
  const [data, technicians] = await Promise.all([
    loadInspectionRunnerData(orgId, inspectionId, id),
    loadTechnicians(orgId),
  ]);
  if (!data) notFound();
  return (
    <InspectionRunner
      data={data}
      technicians={technicians}
      actions={{
        rate: rateInspectionItem,
        note: noteInspectionItem,
        addPhotos: addInspectionPhotos,
        deletePhoto: deleteInspectionPhoto,
        setTechnician: setInspectionTechnician,
        setSummary: setInspectionSummary,
        complete: completeInspection,
        reopen: reopenInspection,
        addJob: addJobFromInspectionItem,
        send: sendInspectionToCustomer,
        ...(user.role !== "STAFF"
          ? { delete: deleteInspection }
          : {}),
      }}
      backHref={`/repair-orders/${id}`}
      backLabel={`← RO #${data.roNumber}`}
    />
  );
}
