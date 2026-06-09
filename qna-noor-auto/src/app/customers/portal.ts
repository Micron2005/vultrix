"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";

async function newToken(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const t = randomBytes(16).toString("base64url");
    const existing = await db.customer.findUnique({
      where: { portalToken: t },
      select: { id: true },
    });
    if (!existing) return t;
  }
  throw new Error("Could not generate unique portal token");
}

export async function generatePortalToken(id: string) {
  const orgId = await requireOrgId();
  const c = await db.customer.findFirst({
    where: { id, orgId },
    select: { portalToken: true },
  });
  if (!c) return;
  if (!c.portalToken) {
    const token = await newToken();
    await db.customer.update({
      where: { id, orgId },
      data: { portalToken: token },
    });
  }
  revalidatePath(`/customers/${id}`);
}

export async function regeneratePortalToken(id: string) {
  const orgId = await requireOrgId();
  const token = await newToken();
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
