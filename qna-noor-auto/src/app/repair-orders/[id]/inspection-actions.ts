"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assertCanDelete } from "@/lib/permissions";
import { assertROEditable } from "../actions";
import { getAllSettings, shopBranding } from "@/lib/shop";
import { sendEmail, escapeHtml, shopEmailHeader } from "@/lib/email";
import {
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
} from "@/lib/inspections";

const ratingLabel: Record<string, string> = {
  GOOD: "Good",
  ATTENTION: "Needs attention",
  URGENT: "Urgent",
  NA: "N/A",
};

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

async function appOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? (host ? `${proto}://${host}` : "https://vultrix.net");
}

export async function sendInspectionToCustomer(id: string): Promise<{
  emailed: boolean;
  reason: "sent" | "no_email" | "email_not_configured";
}> {
  const { orgId } = await requireAutoShop();
  const inspection = await db.inspection.findFirst({
    where: { id, orgId },
    include: {
      repairOrder: { include: { customer: true, vehicle: true } },
      technician: true,
    },
  });
  if (!inspection) throw new Error("Inspection not found");
  if (inspection.status !== "COMPLETED") throw new Error("Complete the inspection before sending it");
  const sentAt = new Date();
  await db.inspection.update({ where: { id }, data: { sentAt } });
  if (!inspection.repairOrder.customer.email) {
    revalidatePath(`/repair-orders/${inspection.repairOrderId}`);
    revalidatePath(`/repair-orders/${inspection.repairOrderId}/inspections/${id}`);
    return { emailed: false, reason: "no_email" };
  }
  let emailed = false;
  if (inspection.repairOrder.customer.portalToken) {
    const settings = await getAllSettings(orgId);
    const branding = await shopBranding(orgId);
    const shop = settings.shopName || "Your repair shop";
    const origin = await appOrigin();
    const link = `${origin}/p/${inspection.repairOrder.customer.portalToken}/ro/${inspection.repairOrder.id}/inspection/${id}`;
    const header = shopEmailHeader({ shopName: shop, logo: branding.logo, accent: branding.accent });
    emailed = await sendEmail({
      to: inspection.repairOrder.customer.email,
      subject: `Your vehicle inspection from ${shop}`,
      replyTo: settings.shopEmail || undefined,
      html: `${header}<p>Hi ${escapeHtml(inspection.repairOrder.customer.firstName)},</p><p>Your vehicle inspection is ready to view.</p><p><a href="${escapeHtml(link)}">View your inspection report</a></p><p>Thanks,<br>${escapeHtml(shop)}</p>`,
    });
  }
  revalidatePath(`/repair-orders/${inspection.repairOrderId}`);
  revalidatePath(`/repair-orders/${inspection.repairOrderId}/inspections/${id}`);
  return { emailed, reason: emailed ? "sent" : "email_not_configured" };
}

export async function addJobFromInspectionItem(itemId: string) {
  const { orgId } = await requireAutoShop();
  const item = await db.inspectionItem.findFirst({
    where: { id: itemId, inspection: { orgId } },
    include: { inspection: { include: { repairOrder: true } } },
  });
  if (!item) throw new Error("Inspection item not found");
  if (item.jobId) return;
  await assertROEditable(orgId, item.inspection.repairOrderId);
  const max = await db.job.findFirst({ where: { repairOrderId: item.inspection.repairOrderId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const job = await db.job.create({
    data: {
      repairOrderId: item.inspection.repairOrderId,
      name: item.name,
      notes: `Inspection: ${ratingLabel[item.rating ?? "ATTENTION"] ?? "Needs attention"}. ${item.note ?? ""}`.trim(),
      sortOrder: (max?.sortOrder ?? 0) + 1,
    },
  });
  await db.inspectionItem.update({ where: { id: itemId }, data: { jobId: job.id } });
  revalidatePath(`/repair-orders/${item.inspection.repairOrderId}`);
  revalidatePath(`/repair-orders/${item.inspection.repairOrderId}/inspections/${item.inspection.id}`);
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
