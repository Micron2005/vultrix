"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";
import { assertCanManageSettings } from "@/lib/permissions";

function access() {
  return requireUser().then((user) => {
    if (user.accountType !== "AUTO_SHOP") throw new Error("Inspection templates are only available for auto shops");
    assertCanManageSettings(user.role);
  });
}

export async function createInspectionTemplate(fd: FormData) {
  const orgId = await requireOrgId();
  await access();
  const clean = String(fd.get("name") ?? "").trim().slice(0, 100);
  if (!clean) throw new Error("Template name is required");
  const last = await db.inspectionTemplate.findFirst({ where: { orgId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const template = await db.inspectionTemplate.create({ data: { orgId, name: clean, sortOrder: (last?.sortOrder ?? -1) + 1 } });
  revalidatePath("/settings/inspections");
  redirect(`/settings/inspections/${template.id}`);
}

export async function renameInspectionTemplate(id: string, fd: FormData) {
  const orgId = await requireOrgId();
  await access();
  await db.inspectionTemplate.updateMany({ where: { id, orgId }, data: { name: String(fd.get("name") ?? "").trim().slice(0, 100) } });
  revalidatePath("/settings/inspections");
  revalidatePath(`/settings/inspections/${id}`);
}

export async function deleteInspectionTemplate(id: string) {
  const orgId = await requireOrgId();
  await access();
  await db.inspectionTemplate.deleteMany({ where: { id, orgId } });
  revalidatePath("/settings/inspections");
  redirect("/settings/inspections");
}

export async function saveInspectionTemplateItems(
  templateId: string,
  items: { section: string; name: string }[],
) {
  const orgId = await requireOrgId();
  await access();
  if (!Array.isArray(items) || items.length > 80) throw new Error("Templates can have up to 80 items");
  const template = await db.inspectionTemplate.findFirst({ where: { id: templateId, orgId }, select: { id: true } });
  if (!template) throw new Error("Inspection template not found");
  const clean = items
    .map((item) => ({ section: item.section.trim().slice(0, 80), name: item.name.trim().slice(0, 120) }))
    .filter((item) => item.section && item.name);
  await db.$transaction([
    db.inspectionTemplateItem.deleteMany({ where: { templateId } }),
    db.inspectionTemplateItem.createMany({ data: clean.map((item, sortOrder) => ({ ...item, templateId, sortOrder })) }),
  ]);
  revalidatePath("/settings/inspections");
  revalidatePath(`/settings/inspections/${templateId}`);
}
