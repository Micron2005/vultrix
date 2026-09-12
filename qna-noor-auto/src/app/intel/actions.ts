"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertCanDelete } from "@/lib/permissions";
import { requireOrgId, requireUser } from "@/lib/session";
import { detectPlatform } from "@/lib/vehicleLinks";

const VehicleLinkSchema = z.object({
  url: z.string().trim().url("Enter a valid URL.").max(2_000),
  title: z.string().trim().min(1, "Title is required.").max(120),
  notes: z.string().trim().max(2_000).optional().nullable(),
  year: z.string().optional().nullable(),
  yearMin: z.string().optional().nullable(),
  yearMax: z.string().optional().nullable(),
  make: z.string().trim().max(120).optional().nullable(),
  model: z.string().trim().max(120).optional().nullable(),
  engine: z.string().trim().max(120).optional().nullable(),
  shared: z.string().optional().nullable(),
});

export type VehicleLinkActionResult = {
  ok: boolean;
  error?: string;
};

function parseYear(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const year = Number(trimmed);
  return Number.isInteger(year) && year >= 1886 && year <= 2100
    ? year
    : null;
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export async function addVehicleLink(
  formData: FormData,
): Promise<VehicleLinkActionResult> {
  const orgId = await requireOrgId();
  const user = await requireUser();
  if (user.accountType !== "AUTO_SHOP") {
    return { ok: false, error: "Vehicle links are available to auto shops only." };
  }

  const parsed = VehicleLinkSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the link details.",
    };
  }

  const input = parsed.data;
  const year = parseYear(input.year);
  const yearMin = parseYear(input.yearMin) ?? year;
  const yearMax = parseYear(input.yearMax) ?? year;
  if (
    (input.yearMin && yearMin == null) ||
    (input.yearMax && yearMax == null) ||
    (yearMin != null && yearMax != null && yearMin > yearMax)
  ) {
    return { ok: false, error: "Enter a valid year range." };
  }

  let detected;
  try {
    detected = await detectPlatform(input.url);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Enter a valid link.",
    };
  }

  await db.vehicleLink.create({
    data: {
      orgId,
      createdById: user.id,
      url: input.url.trim(),
      platform: detected.platform,
      title: input.title.trim(),
      notes: clean(input.notes),
      yearMin,
      yearMax,
      make: clean(input.make),
      model: clean(input.model),
      engine: clean(input.engine),
      thumbnailUrl: detected.thumbnailUrl,
      shared: input.shared === "on" || input.shared === "true",
    },
  });
  revalidatePath("/intel");
  return { ok: true };
}

export async function deleteVehicleLink(
  id: string,
): Promise<VehicleLinkActionResult> {
  const orgId = await requireOrgId();
  const user = await requireUser();
  assertCanDelete(user.role);

  const result = await db.vehicleLink.deleteMany({
    where: { id, orgId },
  });
  if (result.count === 0) return { ok: false, error: "Link not found." };
  revalidatePath("/intel");
  return { ok: true };
}
