"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  ensurePortalToken,
  newPortalToken,
} from "@/lib/portalToken";
import { requireOrgId } from "@/lib/session";

export async function generatePortalToken(id: string) {
  const orgId = await requireOrgId();
  const c = await db.customer.findFirst({
    where: { id, orgId },
    select: { portalToken: true },
  });
  if (!c) return;
  if (!c.portalToken) {
    await ensurePortalToken(orgId, id);
  }
  revalidatePath(`/customers/${id}`);
}

export async function regeneratePortalToken(id: string) {
  const orgId = await requireOrgId();
  const token = await newPortalToken();
  await db.customer.update({
    where: { id, orgId },
    data: { portalToken: token },
  });
  revalidatePath(`/customers/${id}`);
}

export async function revokePortalToken(id: string) {
  const orgId = await requireOrgId();
  await db.customer.update({
    where: { id, orgId },
    data: { portalToken: null },
  });
  revalidatePath(`/customers/${id}`);
}
