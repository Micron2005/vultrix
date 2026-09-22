import { revalidatePath } from "next/cache";
import { db } from "./db";
import { fullName, vehicleLabel } from "./utils";

export type Rating = "GOOD" | "ATTENTION" | "URGENT" | "NA" | null;

export type InspectionRunnerData = {
  id: string;
  repairOrderId: string;
  roNumber: number;
  vehicle: string;
  customerName: string;
  customerEmail: string | null;
  portalToken: string | null;
  templateName: string;
  status: string;
  sentAt: string | null;
  sendReason: "sent" | "no_email" | "email_not_configured" | null;
  summary: string;
  technicianId: string | null;
  items: Array<{
    id: string;
    section: string;
    name: string;
    rating: Rating;
    note: string;
    jobId: string | null;
    photos: Array<{ id: string; dataUrl: string }>;
  }>;
};

export type InspectionMutationTarget = {
  inspectionId: string;
  repairOrderId: string;
};

export const RATINGS = new Set(["GOOD", "ATTENTION", "URGENT", "NA"]);
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

export async function createInspectionFromTemplate(
  orgId: string,
  repairOrderId: string,
  templateId: string,
): Promise<string> {
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
  return inspection.id;
}

export async function inspectionForOrg(id: string, orgId: string) {
  return db.inspection.findFirst({
    where: { id, orgId },
    include: {
      repairOrder: {
        select: { id: true, customerId: true, roNumber: true, orgId: true },
      },
    },
  });
}

export async function itemForOrg(itemId: string, orgId: string) {
  return db.inspectionItem.findFirst({
    where: { id: itemId, inspection: { orgId } },
    include: {
      inspection: {
        select: { id: true, repairOrderId: true, status: true },
      },
    },
  });
}

function revalidateInspection(target: InspectionMutationTarget) {
  revalidatePath(
    `/repair-orders/${target.repairOrderId}/inspections/${target.inspectionId}`,
  );
}

export async function rateItem(
  orgId: string,
  itemId: string,
  rating: Rating,
): Promise<InspectionMutationTarget> {
  if (rating !== null && !RATINGS.has(rating)) {
    throw new Error("Invalid inspection rating");
  }
  const item = await itemForOrg(itemId, orgId);
  if (!item) throw new Error("Inspection item not found");
  await db.inspectionItem.update({ where: { id: itemId }, data: { rating } });
  const target = {
    inspectionId: item.inspection.id,
    repairOrderId: item.inspection.repairOrderId,
  };
  revalidateInspection(target);
  return target;
}

export async function noteItem(
  orgId: string,
  itemId: string,
  note: string,
): Promise<InspectionMutationTarget> {
  const item = await itemForOrg(itemId, orgId);
  if (!item) throw new Error("Inspection item not found");
  await db.inspectionItem.update({
    where: { id: itemId },
    data: { note: note.trim().slice(0, 500) || null },
  });
  const target = {
    inspectionId: item.inspection.id,
    repairOrderId: item.inspection.repairOrderId,
  };
  revalidateInspection(target);
  return target;
}

export async function addItemPhotos(
  orgId: string,
  itemId: string,
  dataUrls: string[],
): Promise<InspectionMutationTarget> {
  const item = await itemForOrg(itemId, orgId);
  if (!item) throw new Error("Inspection item not found");
  const target = {
    inspectionId: item.inspection.id,
    repairOrderId: item.inspection.repairOrderId,
  };
  if (!Array.isArray(dataUrls) || dataUrls.length === 0) return target;
  const count = await db.inspectionPhoto.count({ where: { itemId } });
  if (count + dataUrls.length > 6) throw new Error("Up to 6 photos per item");
  for (const dataUrl of dataUrls) {
    const clean = String(dataUrl ?? "").trim();
    if (!clean.startsWith("data:image/")) {
      throw new Error("One of the files isn't a valid image.");
    }
    if (clean.length > MAX_PHOTO_BYTES) {
      throw new Error("An image is too large even after resizing.");
    }
    await db.inspectionPhoto.create({
      data: { orgId, itemId, dataUrl: clean },
    });
  }
  revalidateInspection(target);
  return target;
}

export async function deleteItemPhoto(
  orgId: string,
  photoId: string,
): Promise<InspectionMutationTarget> {
  const photo = await db.inspectionPhoto.findFirst({
    where: { id: photoId, orgId },
    include: {
      item: {
        include: {
          inspection: { select: { id: true, repairOrderId: true } },
        },
      },
    },
  });
  if (!photo) throw new Error("Photo not found");
  await db.inspectionPhoto.delete({ where: { id: photoId } });
  const target = {
    inspectionId: photo.item.inspection.id,
    repairOrderId: photo.item.inspection.repairOrderId,
  };
  revalidateInspection(target);
  return target;
}

export async function setTechnician(
  orgId: string,
  inspectionId: string,
  technicianId: string | null,
): Promise<InspectionMutationTarget> {
  const inspection = await inspectionForOrg(inspectionId, orgId);
  if (!inspection) throw new Error("Inspection not found");
  if (technicianId) {
    const tech = await db.technician.findFirst({
      where: { id: technicianId, orgId },
    });
    if (!tech) throw new Error("Technician not found");
  }
  await db.inspection.update({
    where: { id: inspectionId },
    data: { technicianId: technicianId || null },
  });
  const target = {
    inspectionId,
    repairOrderId: inspection.repairOrderId,
  };
  revalidateInspection(target);
  return target;
}

export async function setSummary(
  orgId: string,
  inspectionId: string,
  text: string,
): Promise<InspectionMutationTarget> {
  const inspection = await inspectionForOrg(inspectionId, orgId);
  if (!inspection) throw new Error("Inspection not found");
  await db.inspection.update({
    where: { id: inspectionId },
    data: { summary: text.trim().slice(0, 1000) || null },
  });
  const target = {
    inspectionId,
    repairOrderId: inspection.repairOrderId,
  };
  revalidateInspection(target);
  return target;
}

export async function complete(
  orgId: string,
  inspectionId: string,
): Promise<InspectionMutationTarget> {
  const inspection = await inspectionForOrg(inspectionId, orgId);
  if (!inspection) throw new Error("Inspection not found");
  await db.inspection.update({
    where: { id: inspectionId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  const target = {
    inspectionId,
    repairOrderId: inspection.repairOrderId,
  };
  revalidatePath(`/repair-orders/${target.repairOrderId}`);
  revalidateInspection(target);
  return target;
}

export async function reopen(
  orgId: string,
  inspectionId: string,
): Promise<InspectionMutationTarget> {
  const inspection = await inspectionForOrg(inspectionId, orgId);
  if (!inspection) throw new Error("Inspection not found");
  await db.inspection.update({
    where: { id: inspectionId },
    data: { status: "IN_PROGRESS", completedAt: null, sentAt: null },
  });
  const target = {
    inspectionId,
    repairOrderId: inspection.repairOrderId,
  };
  revalidatePath(`/repair-orders/${target.repairOrderId}`);
  revalidateInspection(target);
  return target;
}

export async function loadInspectionRunnerData(
  orgId: string,
  inspectionId: string,
  repairOrderId?: string,
): Promise<InspectionRunnerData | null> {
  const inspection = await db.inspection.findFirst({
    where: {
      id: inspectionId,
      orgId,
      ...(repairOrderId ? { repairOrderId } : {}),
    },
    include: {
      repairOrder: {
        include: {
          vehicle: true,
          customer: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              portalToken: true,
            },
          },
        },
      },
      technician: true,
      items: {
        orderBy: { sortOrder: "asc" },
        include: { photos: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!inspection) return null;
  return {
    id: inspection.id,
    repairOrderId: inspection.repairOrderId,
    roNumber: inspection.repairOrder.roNumber,
    vehicle: inspection.repairOrder.vehicle
      ? vehicleLabel(inspection.repairOrder.vehicle)
      : `RO #${inspection.repairOrder.roNumber}`,
    customerName: fullName(inspection.repairOrder.customer),
    customerEmail: inspection.repairOrder.customer.email,
    portalToken: inspection.repairOrder.customer.portalToken,
    templateName: inspection.templateName,
    status: inspection.status,
    sentAt: inspection.sentAt?.toISOString() ?? null,
    sendReason: null,
    summary: inspection.summary ?? "",
    technicianId: inspection.technicianId,
    items: inspection.items.map((item) => ({
      id: item.id,
      section: item.section,
      name: item.name,
      rating: item.rating as Rating,
      note: item.note ?? "",
      jobId: item.jobId,
      photos: item.photos.map((photo) => ({
        id: photo.id,
        dataUrl: photo.dataUrl,
      })),
    })),
  };
}

export async function loadTechnicians(
  orgId: string,
): Promise<Array<{ id: string; name: string }>> {
  return db.technician.findMany({
    where: { orgId, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
