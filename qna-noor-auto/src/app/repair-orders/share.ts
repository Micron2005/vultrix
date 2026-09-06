"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { notify } from "@/lib/notifications";
import { fullName } from "@/lib/utils";

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
  const orgId = await requireOrgId();
  const ro = await db.repairOrder.findFirst({
    where: { id, orgId },
    select: { shareToken: true },
  });
  if (!ro) return;
  if (!ro.shareToken) {
    const token = await newToken();
    await db.repairOrder.update({
      where: { id, orgId },
      data: { shareToken: token },
    });
  }
  revalidatePath(`/repair-orders/${id}`);
}

export async function revokeShareToken(id: string) {
  const orgId = await requireOrgId();
  await db.repairOrder.updateMany({
    where: { id, orgId },
    data: { shareToken: null },
  });
  revalidatePath(`/repair-orders/${id}`);
}

export async function regenerateShareToken(id: string) {
  const orgId = await requireOrgId();
  const owned = await db.repairOrder.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  if (!owned) return;
  const token = await newToken();
  await db.repairOrder.update({
    where: { id, orgId },
    data: { shareToken: token },
  });
  revalidatePath(`/repair-orders/${id}`);
}

async function findByToken(token: string) {
  return db.repairOrder.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      orgId: true,
      roNumber: true,
      status: true,
      approvedAt: true,
      estimateDeclinedAt: true,
      customer: {
        select: { firstName: true, lastName: true, companyName: true },
      },
    },
  });
}

export async function approveEstimate(token: string, fd: FormData) {
  const ro = await findByToken(token);
  if (!ro) return;
  if (ro.approvedAt || ro.estimateDeclinedAt) return; // already responded

  const note =
    String(fd.get("customerResponseNote") ?? "").trim() || null;

  // Optional customer signature (insurance claims). Stored only when a real
  // drawn PNG data URL is present; capped to avoid oversized payloads.
  const sigName = String(fd.get("signatureName") ?? "").trim() || null;
  const sigData = String(fd.get("signatureDataUrl") ?? "").trim();
  const hasSignature =
    sigData.startsWith("data:image/") && sigData.length <= 500_000;

  const now = new Date();
  const data: Record<string, unknown> = {
    approvedAt: now,
    customerResponseNote: note,
  };
  if (hasSignature) {
    data.signatureDataUrl = sigData;
    data.signatureName = sigName;
    data.signedAt = now;
  }
  // Flip ESTIMATE → IN_PROGRESS on approval, record startedAt.
  if (ro.status === "ESTIMATE") {
    data.status = "IN_PROGRESS";
    data.startedAt = now;
  }
  await db.repairOrder.update({ where: { id: ro.id }, data });
  await notify({
    orgId: ro.orgId,
    kind: "estimate",
    title: `${fullName(ro.customer)} approved the estimate for RO #${ro.roNumber}`,
    href: `/repair-orders/${ro.id}`,
  });

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
  await notify({
    orgId: ro.orgId,
    kind: "estimate",
    title: `${fullName(ro.customer)} declined the estimate for RO #${ro.roNumber}`,
    href: `/repair-orders/${ro.id}`,
  });

  revalidatePath(`/e/${token}`);
  revalidatePath(`/repair-orders/${ro.id}`);
  revalidatePath("/repair-orders");
  revalidatePath("/");
  redirect(`/e/${token}`);
}

export async function approveJob(
  token: string,
  jobId: string,
  fd: FormData,
) {
  const ro = await findByToken(token);
  if (!ro) return;

  const job = await db.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      name: true,
      repairOrderId: true,
      approvalStatus: true,
    },
  });
  if (!job || job.repairOrderId !== ro.id) return;
  if (job.approvalStatus !== "PENDING") return;

  const note =
    String(fd.get("customerNote") ?? "").trim() || null;

  await db.job.update({
    where: { id: jobId },
    data: {
      approvalStatus: "APPROVED",
      approvedAt: new Date(),
      customerNote: note,
    },
  });
  await notify({
    orgId: ro.orgId,
    kind: "estimate",
    title: `${fullName(ro.customer)} approved job “${job.name}”`,
    href: `/repair-orders/${ro.id}`,
  });

  revalidatePath(`/e/${token}`);
  revalidatePath(`/repair-orders/${ro.id}`);
  redirect(`/e/${token}`);
}

export async function declineJob(
  token: string,
  jobId: string,
  fd: FormData,
) {
  const ro = await findByToken(token);
  if (!ro) return;

  const job = await db.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      name: true,
      repairOrderId: true,
      approvalStatus: true,
    },
  });
  if (!job || job.repairOrderId !== ro.id) return;
  if (job.approvalStatus !== "PENDING") return;

  const note =
    String(fd.get("customerNote") ?? "").trim() || null;

  await db.job.update({
    where: { id: jobId },
    data: {
      approvalStatus: "DECLINED",
      declinedAt: new Date(),
      customerNote: note,
    },
  });
  await notify({
    orgId: ro.orgId,
    kind: "estimate",
    title: `${fullName(ro.customer)} declined job “${job.name}”`,
    href: `/repair-orders/${ro.id}`,
  });

  revalidatePath(`/e/${token}`);
  revalidatePath(`/repair-orders/${ro.id}`);
  redirect(`/e/${token}`);
}
