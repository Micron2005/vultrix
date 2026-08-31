"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";
import { assertCanDelete } from "@/lib/permissions";

function categoryName(formData: FormData): string {
  return String(formData.get("name") ?? "").trim();
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string }).code === "P2002";
}

export async function createCategory(formData: FormData) {
  const orgId = await requireOrgId();
  const name = categoryName(formData);
  if (!name) redirect("/inventory/categories");

  let category;
  try {
    category = await db.category.create({
      data: { name, orgId },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    category = await db.category.findUnique({
      where: { orgId_name: { orgId, name } },
    });
    if (!category) throw error;
  }

  revalidatePath("/inventory");
  revalidatePath("/inventory/categories");
  redirect(`/inventory/categories/${category.id}`);
}

export async function chooseCategoryForNewPart(formData: FormData) {
  const orgId = await requireOrgId();
  const fresh = String(formData.get("fresh") ?? "").trim();
  const existing = String(formData.get("existing") ?? "").trim();
  const name = fresh || existing;

  if (!name) redirect("/inventory/new");

  if (fresh) {
    try {
      await db.category.create({
        data: { name: fresh, orgId },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  redirect(`/inventory/new?category=${encodeURIComponent(name)}`);
}

export async function renameCategory(id: string, formData: FormData) {
  const orgId = await requireOrgId();
  const name = categoryName(formData);
  if (!name) redirect(`/inventory/categories/${id}`);

  const category = await db.category.findFirst({
    where: { id, orgId },
    select: { id: true, name: true },
  });
  if (!category) redirect("/inventory/categories");

  const conflict = await db.category.findFirst({
    where: { orgId, name, id: { not: id } },
    select: { id: true },
  });
  if (conflict) redirect(`/inventory/categories/${conflict.id}`);

  try {
    await db.$transaction([
      db.category.update({
        where: { id: category.id },
        data: { name },
      }),
      db.part.updateMany({
        where: { orgId, category: category.name },
        data: { category: name },
      }),
    ]);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await db.category.findUnique({
      where: { orgId_name: { orgId, name } },
      select: { id: true },
    });
    if (existing) redirect(`/inventory/categories/${existing.id}`);
    throw error;
  }

  revalidatePath("/inventory");
  revalidatePath("/inventory/categories");
  revalidatePath(`/inventory/categories/${id}`);
  redirect(`/inventory/categories/${id}`);
}

export async function deleteCategory(id: string) {
  const orgId = await requireOrgId();
  assertCanDelete((await requireUser()).role);
  const category = await db.category.findFirst({
    where: { id, orgId },
    select: { id: true, name: true },
  });
  if (!category) redirect("/inventory/categories");

  await db.$transaction([
    db.part.updateMany({
      where: { orgId, category: category.name },
      data: { category: null },
    }),
    db.category.delete({ where: { id: category.id } }),
  ]);

  revalidatePath("/inventory");
  revalidatePath("/inventory/categories");
  redirect("/inventory/categories");
}
