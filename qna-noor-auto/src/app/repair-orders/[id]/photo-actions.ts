"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import {
  MAX_PHOTOS_PER_RO,
  type NewPhoto,
  type PhotoActionResult,
} from "./photo-constants";

// Generous per-image ceiling. The client resizes/compresses before upload, so
// real photos land well under this; the cap just guards against abuse.
const MAX_DATAURL_BYTES = 4 * 1024 * 1024; // ~4MB encoded

/**
 * Attach one or more photos (client-resized JPEG/PNG data URLs) to a repair
 * order. Tenant-scoped: the RO must belong to the caller's organization.
 */
export async function addRoPhotos(
  repairOrderId: string,
  items: NewPhoto[],
): Promise<PhotoActionResult> {
  const orgId = await requireOrgId();

  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "No photos to add." };
  }

  const ro = await db.repairOrder.findFirst({
    where: { id: repairOrderId, orgId },
    select: { id: true },
  });
  if (!ro) return { ok: false, error: "Repair order not found." };

  const current = await db.repairOrderPhoto.count({ where: { repairOrderId } });
  if (current + items.length > MAX_PHOTOS_PER_RO) {
    return {
      ok: false,
      error: `That would exceed the ${MAX_PHOTOS_PER_RO}-photo limit for this repair order.`,
    };
  }

  const clean: { repairOrderId: string; orgId: string; dataUrl: string; caption: string | null; sortOrder: number }[] = [];
  let sort = current;
  for (const item of items) {
    const dataUrl = (item?.dataUrl ?? "").trim();
    if (!dataUrl.startsWith("data:image/")) {
      return { ok: false, error: "One of the files isn't a valid image." };
    }
    if (dataUrl.length > MAX_DATAURL_BYTES) {
      return { ok: false, error: "An image is too large even after resizing. Try a smaller photo." };
    }
    const caption = (item?.caption ?? "").trim().slice(0, 200);
    clean.push({ repairOrderId, orgId, dataUrl, caption: caption || null, sortOrder: sort++ });
  }

  await db.repairOrderPhoto.createMany({ data: clean });
  revalidatePath(`/repair-orders/${repairOrderId}`);
  return { ok: true };
}

/** Delete a single photo. Tenant-scoped by orgId. */
export async function deleteRoPhoto(photoId: string): Promise<PhotoActionResult> {
  const orgId = await requireOrgId();

  const photo = await db.repairOrderPhoto.findFirst({
    where: { id: photoId, orgId },
    select: { id: true, repairOrderId: true },
  });
  if (!photo) return { ok: false, error: "Photo not found." };

  await db.repairOrderPhoto.delete({ where: { id: photo.id } });
  revalidatePath(`/repair-orders/${photo.repairOrderId}`);
  return { ok: true };
}
