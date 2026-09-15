"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";
import { assertCanDelete } from "@/lib/permissions";
import { assertROEditable } from "../actions";
import { getAllSettings, shopBranding } from "@/lib/shop";
import { sendEmail, escapeHtml, shopEmailHeader } from "@/lib/email";

const RATINGS = new Set(["GOOD", "ATTENTION", "URGENT", "NA"]);
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const ratingLabel: Record<string, string> = {
  GOOD: "Good",
  ATTENTION: "Needs attention",
  URGENT: "Urgent",
  NA: "N/A",
};

async function inspectionForOrg(id: string, orgId: string) {
  return db.inspection.findFirst({
    where: { id, orgId },
    include: { repairOrder: { select: { id: true, customerId: true, roNumber: true, orgId: true } } },
  });
}

async function itemForOrg(itemId: string, orgId: string) {
  return db.inspectionItem.findFirst({
    where: { id: itemId, inspection: { orgId } },
    include: { inspection: { select: { id: true, repairOrderId: true, status: true } } },
  });
}

export async function startInspection(repairOrderId: string, fd: FormData) {
  const orgId = await requireOrgId();
  const templateId = String(fd.get("templateId") ?? "");
  const ro = await db.repairOrder.findFirst({
    where: { id: repairOrderId, orgId },
    select: { id: true },
  });
  if (!ro) throw new Error("Repair order not found");
  const template = await db.inspectionTemplate.findFirst({
    where: { id: templateId, orgId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) throw new Error("Inspection template not found");
  const inspection = await db.inspection.create({
    data: {
      orgId,
      repairOrderId,
      templateName: template.name,
      items: {
        create: template.items.map((item) => ({
          section: item.section,
          name: item.name,
          sortOrder: item.sortOrder,
        })),
      },
    },
  });
  revalidatePath(`/repair-orders/${repairOrderId}`);
  redirect(`/repair-orders/${repairOrderId}/inspections/${inspection.id}`);
}

export async function rateInspectionItem(
  itemId: string,
  rating: "GOOD" | "ATTENTION" | "URGENT" | "NA" | null,
) {
  const orgId = await requireOrgId();
  if (rating !== null && !RATINGS.has(rating)) throw new Error("Invalid inspection rating");
  const item = await itemForOrg(itemId, orgId);
  if (!item) throw new Error("Inspection item not found");
  await db.inspectionItem.update({ where: { id: itemId }, data: { rating } });
  revalidatePath(`/repair-orders/${item.inspection.repairOrderId}/inspections/${item.inspection.id}`);
}

export async function noteInspectionItem(itemId: string, note: string) {
  const orgId = await requireOrgId();
  const item = await itemForOrg(itemId, orgId);
  if (!item) throw new Error("Inspection item not found");
  await db.inspectionItem.update({
    where: { id: itemId },
    data: { note: note.trim().slice(0, 500) || null },
  });
  revalidatePath(`/repair-orders/${item.inspection.repairOrderId}/inspections/${item.inspection.id}`);
}

export async function addInspectionPhotos(itemId: string, dataUrls: string[]) {
  const orgId = await requireOrgId();
  const item = await itemForOrg(itemId, orgId);
  if (!item) throw new Error("Inspection item not found");
  if (!Array.isArray(dataUrls) || dataUrls.length === 0) return;
  const count = await db.inspectionPhoto.count({ where: { itemId } });
  if (count + dataUrls.length > 6) throw new Error("Up to 6 photos per item");
  for (const dataUrl of dataUrls) {
    const clean = String(dataUrl ?? "").trim();
    if (!clean.startsWith("data:image/")) throw new Error("One of the files isn't a valid image.");
    if (clean.length > MAX_PHOTO_BYTES) throw new Error("An image is too large even after resizing.");
    await db.inspectionPhoto.create({ data: { orgId, itemId, dataUrl: clean } });
  }
  revalidatePath(`/repair-orders/${item.inspection.repairOrderId}/inspections/${item.inspection.id}`);
}

export async function deleteInspectionPhoto(photoId: string) {
  const orgId = await requireOrgId();
  const photo = await db.inspectionPhoto.findFirst({
    where: { id: photoId, orgId },
    include: { item: { include: { inspection: { select: { id: true, repairOrderId: true } } } } },
  });
  if (!photo) throw new Error("Photo not found");
  await db.inspectionPhoto.delete({ where: { id: photoId } });
  revalidatePath(`/repair-orders/${photo.item.inspection.repairOrderId}/inspections/${photo.item.inspection.id}`);
}

export async function setInspectionTechnician(id: string, technicianId: string | null) {
  const orgId = await requireOrgId();
  const inspection = await inspectionForOrg(id, orgId);
  if (!inspection) throw new Error("Inspection not found");
  if (technicianId) {
    const tech = await db.technician.findFirst({ where: { id: technicianId, orgId } });
    if (!tech) throw new Error("Technician not found");
  }
  await db.inspection.update({ where: { id }, data: { technicianId: technicianId || null } });
  revalidatePath(`/repair-orders/${inspection.repairOrderId}/inspections/${id}`);
}

export async function setInspectionSummary(id: string, text: string) {
  const orgId = await requireOrgId();
  const inspection = await inspectionForOrg(id, orgId);
  if (!inspection) throw new Error("Inspection not found");
  await db.inspection.update({ where: { id }, data: { summary: text.trim().slice(0, 1000) || null } });
  revalidatePath(`/repair-orders/${inspection.repairOrderId}/inspections/${id}`);
}

export async function completeInspection(id: string) {
  const orgId = await requireOrgId();
  const inspection = await inspectionForOrg(id, orgId);
  if (!inspection) throw new Error("Inspection not found");
  await db.inspection.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  revalidatePath(`/repair-orders/${inspection.repairOrderId}`);
  revalidatePath(`/repair-orders/${inspection.repairOrderId}/inspections/${id}`);
}

export async function reopenInspection(id: string) {
  const orgId = await requireOrgId();
  const inspection = await inspectionForOrg(id, orgId);
  if (!inspection) throw new Error("Inspection not found");
  await db.inspection.update({ where: { id }, data: { status: "IN_PROGRESS", completedAt: null, sentAt: null } });
  revalidatePath(`/repair-orders/${inspection.repairOrderId}`);
  revalidatePath(`/repair-orders/${inspection.repairOrderId}/inspections/${id}`);
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
  const orgId = await requireOrgId();
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
  const orgId = await requireOrgId();
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
  const orgId = await requireOrgId();
  const user = await requireUser();
  assertCanDelete(user.role);
  const inspection = await inspectionForOrg(id, orgId);
  if (!inspection) throw new Error("Inspection not found");
  await db.inspection.delete({ where: { id } });
  revalidatePath(`/repair-orders/${inspection.repairOrderId}`);
  redirect(`/repair-orders/${inspection.repairOrderId}`);
}
