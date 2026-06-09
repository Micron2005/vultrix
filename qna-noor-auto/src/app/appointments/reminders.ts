"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";

async function newReminderToken(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const t = randomBytes(16).toString("base64url");
    const existing = await db.appointment.findUnique({
      where: { shareToken: t },
      select: { id: true },
    });
    if (!existing) return t;
  }
  throw new Error("Could not generate unique reminder token");
}

export async function generateReminderToken(id: string) {
  const orgId = await requireOrgId();
  const a = await db.appointment.findFirst({
    where: { id, orgId },
    select: { shareToken: true },
  });
  if (!a) return;
  if (!a.shareToken) {
    const token = await newReminderToken();
    await db.appointment.update({
      where: { id, orgId },
      data: { shareToken: token },
    });
  }
  revalidatePath(`/appointments/${id}`);
}

export async function regenerateReminderToken(id: string) {
  const orgId = await requireOrgId();
  const owned = await db.appointment.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  if (!owned) return;
  const token = await newReminderToken();
  await db.appointment.update({
    where: { id, orgId },
    data: { shareToken: token },
  });
  revalidatePath(`/appointments/${id}`);
}

export async function revokeReminderToken(id: string) {
  const orgId = await requireOrgId();
  await db.appointment.updateMany({
    where: { id, orgId },
    data: { shareToken: null },
  });
  revalidatePath(`/appointments/${id}`);
}
