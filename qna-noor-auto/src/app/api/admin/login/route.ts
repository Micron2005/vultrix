import { NextResponse } from "next/server";
import {
  createSessionWithMaxAge,
  verifyPassword,
} from "@/lib/auth";
import {
  clearFailedLogins,
  consumeBackupCode,
  isLocked,
  recordFailedLogin,
  verifyTotp,
} from "@/lib/adminAuth";
import { db } from "@/lib/db";

const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;

function fail(url: URL, locked = false): NextResponse {
  const loginUrl = new URL("/admin/login", url);
  loginUrl.searchParams.set(locked ? "locked" : "error", "1");
  return NextResponse.redirect(loginUrl, { status: 303 });
}

async function failedUserLogin(url: URL, userId: string): Promise<NextResponse> {
  await recordFailedLogin(userId);
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true },
  });
  return fail(url, isLocked(user ?? { lockedUntil: null }));
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const form = await req.formData();
  const username =
    typeof form.get("username") === "string"
      ? String(form.get("username")).trim()
      : "";
  const usernameLower = username.toLowerCase();
  const password =
    typeof form.get("password") === "string"
      ? String(form.get("password"))
      : "";
  const code =
    typeof form.get("code") === "string" ? String(form.get("code")).trim() : "";

  if (!username || !password) return fail(url);

  const user = await db.user.findUnique({
    where: { usernameLower },
    select: {
      id: true,
      role: true,
      isActive: true,
      passwordHash: true,
      totpSecret: true,
      totpBackupCodes: true,
      lockedUntil: true,
    },
  });

  if (!user) return fail(url);
  if (isLocked(user)) return fail(url, true);
  if (
    !user.isActive ||
    user.role !== "SUPERADMIN" ||
    !verifyPassword(password, user.passwordHash)
  ) {
    return failedUserLogin(url, user.id);
  }

  if (user.totpSecret) {
    let verified = verifyTotp(user.totpSecret, code);
    if (!verified) {
      const remaining = consumeBackupCode(user.totpBackupCodes, code);
      if (!remaining) return failedUserLogin(url, user.id);
      await db.user.update({
        where: { id: user.id },
        data: { totpBackupCodes: remaining },
      });
      verified = true;
    }
    if (!verified) return failedUserLogin(url, user.id);
  }

  await clearFailedLogins(user.id);
  await createSessionWithMaxAge(user.id, ADMIN_SESSION_MAX_AGE);
  return NextResponse.redirect(
    new URL(user.totpSecret ? "/admin" : "/admin/security", url),
    { status: 303 },
  );
}
