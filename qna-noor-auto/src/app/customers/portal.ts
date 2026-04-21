"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

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
  const c = await db.customer.findUnique({
    where: { id },
    select: { portalToken: true },
  });
  if (!c) return;
  if (!c.portalToken) {
    const token = await newToken();
    await db.customer.update({
      where: { id },
      data: { portalToken: token },
    });
  }
  revalidatePath(`/customers/${id}`);
}

export async function regeneratePortalToken(id: string) {
  const token = await newToken();
  await db.customer.update({
    where: { id },
    data: { portalToken: token },
  });
  revalidatePath(`/customers/${id}`);
}

export async function revokePortalToken(id: string) {
  await db.customer.update({
    where: { id },
    data: { portalToken: null },
  });
  revalidatePath(`/customers/${id}`);
}
