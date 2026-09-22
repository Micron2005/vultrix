"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assertCanDelete } from "@/lib/permissions";
import {
  addJobFromItem,
  addItemPhotos,
  complete,
  createInspectionFromTemplate,
  deleteItemPhoto,
  inspectionForOrg,
  noteItem,
  rateItem,
  reopen,
  setSummary,
  setTechnician,
  sendToCustomer,
} from "@/lib/inspections";

async function requireAutoShop() {
  const user = await requireUser();
  if (user.accountType !== "AUTO_SHOP" || !user.orgId) {
    throw new Error("Vehicle inspections are only available for auto shops");
  }
  return { user, orgId: user.orgId };
}

export async function startInspection(repairOrderId: string, fd: FormData) {
  const { orgId } = await requireAutoShop();
  const templateId = String(fd.get("templateId") ?? "");
  const inspectionId = await createInspectionFromTemplate(
    orgId,
    repairOrderId,
    templateId,
  );
  revalidatePath(`/repair-orders/${repairOrderId}`);
  redirect(`/repair-orders/${repairOrderId}/inspections/${inspectionId}`);
}

export async function rateInspectionItem(
  itemId: string,
  rating: "GOOD" | "ATTENTION" | "URGENT" | "NA" | null,
) {
  const { orgId } = await requireAutoShop();
  await rateItem(orgId, itemId, rating);
}

export async function noteInspectionItem(itemId: string, note: string) {
  const { orgId } = await requireAutoShop();
  await noteItem(orgId, itemId, note);
}

export async function addInspectionPhotos(itemId: string, dataUrls: string[]) {
  const { orgId } = await requireAutoShop();
  await addItemPhotos(orgId, itemId, dataUrls);
}

export async function deleteInspectionPhoto(photoId: string) {
  const { orgId } = await requireAutoShop();
  await deleteItemPhoto(orgId, photoId);
}

export async function setInspectionTechnician(id: string, technicianId: string | null) {
  const { orgId } = await requireAutoShop();
  await setTechnician(orgId, id, technicianId);
}

export async function setInspectionSummary(id: string, text: string) {
  const { orgId } = await requireAutoShop();
  await setSummary(orgId, id, text);
}

export async function completeInspection(id: string) {
  const { orgId } = await requireAutoShop();
  await complete(orgId, id);
}

export async function reopenInspection(id: string) {
  const { orgId } = await requireAutoShop();
  await reopen(orgId, id);
}

export async function sendInspectionToCustomer(id: string): Promise<{
  emailed: boolean;
  reason: "sent" | "no_email" | "email_not_configured";
}> {
  const { orgId } = await requireAutoShop();
  return sendToCustomer(orgId, id);
}

export async function addJobFromInspectionItem(itemId: string) {
  const { orgId } = await requireAutoShop();
  await addJobFromItem(orgId, itemId);
}

export async function deleteInspection(id: string) {
  const { orgId, user } = await requireAutoShop();
  assertCanDelete(user.role);
  const inspection = await inspectionForOrg(id, orgId);
  if (!inspection) throw new Error("Inspection not found");
  await db.inspection.delete({ where: { id } });
  revalidatePath(`/repair-orders/${inspection.repairOrderId}`);
  redirect(`/repair-orders/${inspection.repairOrderId}`);
}
