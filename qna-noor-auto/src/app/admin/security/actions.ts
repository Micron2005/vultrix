"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearFailedLogins,
  generateBackupCodes,
  generateTotpSecret,
  verifyTotp,
} from "@/lib/adminAuth";
import { makeSignedValue, verifySignedValue } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";

const PENDING_COOKIE = "admin_totp_pending";
const BACKUP_CODES_COOKIE = "admin_backup_codes_once";
const COOKIE_MAX_AGE = 60 * 5;

function securityUrl(params?: Record<string, string>): string {
  const query = params ? new URLSearchParams(params).toString() : "";
  return `/admin/security${query ? `?${query}` : ""}`;
}

export async function startTotpEnrollment() {
  await requireSuperadmin({ allowUnenrolled: true });
  const secret = generateTotpSecret();
  const store = await cookies();
  store.set(PENDING_COOKIE, makeSignedValue(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  revalidatePath("/admin/security");
  redirect("/admin/security");
}

export async function confirmTotpEnrollment(formData: FormData) {
  const user = await requireSuperadmin({ allowUnenrolled: true });
  const code = String(formData.get("code") ?? "").trim();
  const store = await cookies();
  const secret = verifySignedValue(store.get(PENDING_COOKIE)?.value);
  if (!secret || !verifyTotp(secret, code)) {
    redirect(securityUrl({ error: "invalid-code" }));
  }

  const backupCodes = generateBackupCodes();
  await db.user.update({
    where: { id: user.id },
    data: {
      totpSecret: secret,
      totpBackupCodes: backupCodes.hashes,
    },
  });
  await clearFailedLogins(user.id);
  store.delete(PENDING_COOKIE);
  store.set(BACKUP_CODES_COOKIE, makeSignedValue(JSON.stringify(backupCodes.plain)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  revalidatePath("/admin");
  revalidatePath("/admin/security");
  redirect("/admin/security");
}

export async function clearBackupCodes() {
  await requireSuperadmin({ allowUnenrolled: true });
  const store = await cookies();
  store.delete(BACKUP_CODES_COOKIE);
  redirect("/admin/security");
}

export async function regenerateBackupCodes() {
  const user = await requireSuperadmin({ allowUnenrolled: true });
  if (!user.totpEnrolled) redirect("/admin/security");
  const backupCodes = generateBackupCodes();
  await db.user.update({
    where: { id: user.id },
    data: { totpBackupCodes: backupCodes.hashes },
  });
  const store = await cookies();
  store.set(BACKUP_CODES_COOKIE, makeSignedValue(JSON.stringify(backupCodes.plain)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  revalidatePath("/admin/security");
  redirect("/admin/security");
}

export async function resetAuthenticator(formData: FormData) {
  const user = await requireSuperadmin({ allowUnenrolled: true });
  const code = String(formData.get("code") ?? "").trim();
  const current = await db.user.findUnique({
    where: { id: user.id },
    select: { totpSecret: true },
  });
  if (!current?.totpSecret || !verifyTotp(current.totpSecret, code)) {
    redirect(securityUrl({ error: "reset-code" }));
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      totpSecret: null,
      totpBackupCodes: [],
      failedLogins: 0,
      lockedUntil: null,
    },
  });
  const store = await cookies();
  store.delete(PENDING_COOKIE);
  store.delete(BACKUP_CODES_COOKIE);
  revalidatePath("/admin");
  revalidatePath("/admin/security");
  redirect("/admin/security");
}
