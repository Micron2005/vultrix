"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

async function newToken(): Promise<string> {
  // ~22 chars, URL-safe, non-guessable. Retry if the (astronomically unlikely)
  // collision happens.
  for (let i = 0; i < 5; i++) {
    const t = randomBytes(16).toString("base64url");
    const existing = await db.repairOrder.findUnique({
      where: { shareToken: t },
      select: { id: true },
    });
    if (!existing) return t;
  }
  throw new Error("Could not generate unique share token");
}

export async function generateShareToken(id: string) {
  const ro = await db.repairOrder.findUnique({
    where: { id },
    select: { shareToken: true },
  });
  if (!ro) return;
  if (!ro.shareToken) {
    const token = await newToken();
    await db.repairOrder.update({
      where: { id },
      data: { shareToken: token },
    });
  }
  revalidatePath(`/repair-orders/${id}`);
}

export async function revokeShareToken(id: string) {
  await db.repairOrder.update({
    where: { id },
    data: { shareToken: null },
  });
  revalidatePath(`/repair-orders/${id}`);
}

export async function regenerateShareToken(id: string) {
  const token = await newToken();
  await db.repairOrder.update({
    where: { id },
    data: { shareToken: token },
  });
  revalidatePath(`/repair-orders/${id}`);
}

async function findByToken(token: string) {
  return db.repairOrder.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      status: true,
      approvedAt: true,
      estimateDeclinedAt: true,
    },
  });
}

export async function approveEstimate(token: string, fd: FormData) {
  const ro = await findByToken(token);
  if (!ro) return;
  if (ro.approvedAt || ro.estimateDeclinedAt) return; // already responded

  const note =
    String(fd.get("customerResponseNote") ?? "").trim() || null;

  const now = new Date();
  const data: Record<string, unknown> = {
    approvedAt: now,
    customerResponseNote: note,
  };
  // Flip ESTIMATE → IN_PROGRESS on approval, record startedAt.
  if (ro.status === "ESTIMATE") {
    data.status = "IN_PROGRESS";
    data.startedAt = now;
  }
  await db.repairOrder.update({ where: { id: ro.id }, data });

  revalidatePath(`/e/${token}`);
  revalidatePath(`/repair-orders/${ro.id}`);
  revalidatePath("/repair-orders");
  revalidatePath("/");
  redirect(`/e/${token}`);
}

export async function declineEstimate(token: string, fd: FormData) {
  const ro = await findByToken(token);
  if (!ro) return;
  if (ro.approvedAt || ro.estimateDeclinedAt) return;

  const note =
    String(fd.get("customerResponseNote") ?? "").trim() || null;

  await db.repairOrder.update({
    where: { id: ro.id },
    data: {
      estimateDeclinedAt: new Date(),
      customerResponseNote: note,
    },
  });

  revalidatePath(`/e/${token}`);
  revalidatePath(`/repair-orders/${ro.id}`);
  revalidatePath("/repair-orders");
  revalidatePath("/");
  redirect(`/e/${token}`);
}
