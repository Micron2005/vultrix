import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { verifyOrgIntake } from "@/lib/intakeTokens";
import {
  loadInspectionRunnerData,
  loadTechnicians,
} from "@/lib/inspections";
import { InvalidShell } from "../../../InvalidShell";
import {
  intakeAddPhotos,
  intakeComplete,
  intakeDeletePhoto,
  intakeNoteItem,
  intakeRateItem,
  intakeReopen,
  intakeSetSummary,
  intakeSetTechnician,
} from "../../../inspection-actions";
import { InspectionRunner } from "../../../../repair-orders/[id]/inspections/[inspectionId]/InspectionRunner";

export const dynamic = "force-dynamic";

export default async function IntakeInspectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; inspectionId: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { orgId, inspectionId } = await params;
  const { k = "" } = await searchParams;
  const org = await db.organization.findFirst({
    where: { id: orgId, status: "ACTIVE", accountType: "AUTO_SHOP" },
    select: { id: true },
  });
  if (!org || !verifyOrgIntake(orgId, k)) {
    return <InvalidShell />;
  }

  const [data, technicians] = await Promise.all([
    loadInspectionRunnerData(orgId, inspectionId),
    loadTechnicians(orgId),
  ]);
  if (!data) notFound();
  const backQuery = new URLSearchParams({
    k,
    done: String(data.roNumber),
    roId: data.repairOrderId,
  });
  return (
    <InspectionRunner
      data={data}
      technicians={technicians}
      actions={{
        rate: intakeRateItem.bind(null, orgId, k),
        note: intakeNoteItem.bind(null, orgId, k),
        addPhotos: intakeAddPhotos.bind(null, orgId, k),
        deletePhoto: intakeDeletePhoto.bind(null, orgId, k),
        setTechnician: intakeSetTechnician.bind(null, orgId, k),
        setSummary: intakeSetSummary.bind(null, orgId, k),
        complete: intakeComplete.bind(null, orgId, k),
        reopen: intakeReopen.bind(null, orgId, k),
      }}
      backHref={`/i/${orgId}?${backQuery.toString()}`}
      backLabel="← Intake"
    />
  );
}
