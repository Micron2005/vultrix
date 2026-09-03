import crypto from "node:crypto";
import { Secret, TOTP } from "otpauth";
import { db } from "./db";

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

export function generateTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function totpUri(username: string, secret: string): string {
  return new TOTP({
    issuer: "Vultrix admin",
    label: username,
    secret,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  }).toString();
}

export function verifyTotp(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code.trim())) return false;
  return (
    new TOTP({ secret, algorithm: "SHA1", digits: 6, period: 30 }).validate({
      token: code.trim(),
      window: 1,
    }) !== null
  );
}

const BACKUP_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomBackupPart(): string {
  let part = "";
  while (part.length < 4) {
    for (const byte of crypto.randomBytes(4)) {
      part += BACKUP_ALPHABET[byte % BACKUP_ALPHABET.length];
      if (part.length === 4) break;
    }
  }
  return part;
}

function backupCodeHash(code: string): string {
  return crypto
    .createHash("sha256")
    .update(code.trim().toLowerCase())
    .digest("hex");
}

export function generateBackupCodes(): { plain: string[]; hashes: string[] } {
  const plain = new Set<string>();
  while (plain.size < 8) {
    plain.add(`${randomBackupPart()}-${randomBackupPart()}`);
  }
  const codes = [...plain];
  return { plain: codes, hashes: codes.map(backupCodeHash) };
}

export function consumeBackupCode(
  hashes: string[],
  code: string,
): string[] | null {
  const candidate = Buffer.from(backupCodeHash(code), "hex");
  const index = hashes.findIndex((hash) => {
    const stored = Buffer.from(hash, "hex");
    return (
      stored.length === candidate.length &&
      crypto.timingSafeEqual(stored, candidate)
    );
  });
  if (index < 0) return null;
  return hashes.filter((_, hashIndex) => hashIndex !== index);
}

export async function recordFailedLogin(userId: string): Promise<void> {
  const user = await db.user.update({
    where: { id: userId },
    data: { failedLogins: { increment: 1 } },
    select: { failedLogins: true },
  });
  if (user.failedLogins >= MAX_FAILED_LOGINS) {
    await db.user.update({
      where: { id: userId },
      data: {
        failedLogins: 0,
        lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000),
      },
    });
  }
}

export async function clearFailedLogins(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { failedLogins: 0, lockedUntil: null },
  });
}

export function isLocked(user: {
  lockedUntil: Date | null;
}): boolean {
  return Boolean(user.lockedUntil && user.lockedUntil > new Date());
}
