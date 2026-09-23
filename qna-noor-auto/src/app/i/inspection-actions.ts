"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifyOrgIntake } from "@/lib/intakeTokens";
import {
  addJobFromItem,
  addItemPhotos,
  complete,
  createInspectionFromTemplate,
  deleteItemPhoto,
  noteItem,
  rateItem,
  reopen,
  sendToCustomer,
  setSummary,
  setTechnician,
} from "@/lib/inspections";
import type { Rating } from "@/lib/inspections";

async function requireIntakeOrg(orgId: string, k: string): Promise<void> {
  if (!verifyOrgIntake(orgId, k)) throw new Error("Not allowed");
  const org = await db.organization.findFirst({
    where: { id: orgId, status: "ACTIVE", accountType: "AUTO_SHOP" },
    select: { id: true },
  });
  if (!org) throw new Error("Not allowed");
}

export async function intakeRateItem(
  orgId: string,
  k: string,
  itemId: string,
  rating: Rating,
) {
  await requireIntakeOrg(orgId, k);
  const target = await rateItem(orgId, itemId, rating);
  revalidatePath(`/i/${orgId}/inspect/${target.inspectionId}`);
}

export async function intakeNoteItem(
  orgId: string,
  k: string,
  itemId: string,
  note: string,
) {
  await requireIntakeOrg(orgId, k);
  const target = await noteItem(orgId, itemId, note);
  revalidatePath(`/i/${orgId}/inspect/${target.inspectionId}`);
}

export async function intakeAddPhotos(
  orgId: string,
  k: string,
  itemId: string,
  dataUrls: string[],
) {
  await requireIntakeOrg(orgId, k);
  const target = await addItemPhotos(orgId, itemId, dataUrls);
  revalidatePath(`/i/${orgId}/inspect/${target.inspectionId}`);
}

export async function intakeDeletePhoto(
  orgId: string,
  k: string,
  photoId: string,
) {
  await requireIntakeOrg(orgId, k);
  const target = await deleteItemPhoto(orgId, photoId);
  revalidatePath(`/i/${orgId}/inspect/${target.inspectionId}`);
}

export async function intakeSetTechnician(
  orgId: string,
  k: string,
  inspectionId: string,
  technicianId: string | null,
) {
  await requireIntakeOrg(orgId, k);
  const target = await setTechnician(orgId, inspectionId, technicianId);
  revalidatePath(`/i/${orgId}/inspect/${target.inspectionId}`);
}

export async function intakeSetSummary(
  orgId: string,
  k: string,
  inspectionId: string,
  text: string,
) {
  await requireIntakeOrg(orgId, k);
  const target = await setSummary(orgId, inspectionId, text);
  revalidatePath(`/i/${orgId}/inspect/${target.inspectionId}`);
}

export async function intakeComplete(
  orgId: string,
  k: string,
  inspectionId: string,
) {
  await requireIntakeOrg(orgId, k);
  const target = await complete(orgId, inspectionId);
  revalidatePath(`/i/${orgId}/inspect/${target.inspectionId}`);
}

export async function intakeReopen(
  orgId: string,
  k: string,
  inspectionId: string,
) {
  await requireIntakeOrg(orgId, k);
  const target = await reopen(orgId, inspectionId);
  revalidatePath(`/i/${orgId}/inspect/${target.inspectionId}`);
}

export async function intakeSendToCustomer(
  orgId: string,
  k: string,
  inspectionId: string,
) {
  await requireIntakeOrg(orgId, k);
  const result = await sendToCustomer(orgId, inspectionId);
  revalidatePath(`/i/${orgId}/inspect/${inspectionId}`);
  return result;
}

export async function intakeAddJob(
  orgId: string,
  k: string,
  itemId: string,
) {
  await requireIntakeOrg(orgId, k);
  const target = await addJobFromItem(orgId, itemId);
  revalidatePath(`/i/${orgId}/inspect/${target.inspectionId}`);
}

export async function startIntakeInspection(fd: FormData) {
  const orgId = String(fd.get("orgId") ?? "");
  const k = String(fd.get("k") ?? "");
  const roId = String(fd.get("roId") ?? "");
  const templateId = String(fd.get("templateId") ?? "");
  const done = String(fd.get("done") ?? "");
  await requireIntakeOrg(orgId, k);

  const ro = await db.repairOrder.findFirst({
    where: { id: roId, orgId },
    select: { id: true },
  });
  const doneHref = `/i/${orgId}?${new URLSearchParams({
    k,
    done,
    roId,
  }).toString()}`;
  if (!ro) redirect(doneHref);

  let inspectionId: string;
  try {
    inspectionId = await createInspectionFromTemplate(
      orgId,
      roId,
      templateId,
    );
  } catch {
    redirect(doneHref);
  }
  revalidatePath(`/repair-orders/${roId}`);
  redirect(
    `/i/${orgId}/inspect/${inspectionId}?k=${encodeURIComponent(k)}`,
  );
}
