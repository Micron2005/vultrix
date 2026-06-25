import crypto from "node:crypto";

/**
 * Signed token for the no-login shop-intake QR flow (`/i/<orgId>?k=<token>`).
 *
 * The token is HMAC-SHA256("intake:" + orgId, secret) truncated to 24 hex
 * chars, so a printed QR can't be abused by simply guessing org ids.
 *
 * Secret precedence: INTAKE_SIGNING_SECRET, then STOCK_SCAN_SIGNING_SECRET
 * (so a shop already using the inventory QR-scan secret gets intake for free).
 * If neither is set, no token is produced and the Settings panel shows a
 * "configure a secret" notice instead of a public link.
 */
function intakeSecret(): string | null {
  return (
    process.env.INTAKE_SIGNING_SECRET ||
    process.env.STOCK_SCAN_SIGNING_SECRET ||
    null
  );
}

export function intakeSigningConfigured(): boolean {
  return intakeSecret() !== null;
}

export function signOrgIntake(orgId: string): string | null {
  const secret = intakeSecret();
  if (!secret) return null;
  return crypto
    .createHmac("sha256", secret)
    .update(`intake:${orgId}`)
    .digest("hex")
    .slice(0, 24);
}

export function verifyOrgIntake(orgId: string, token: string): boolean {
  const expected = signOrgIntake(orgId);
  if (!expected || !token) return false;
  if (expected.length !== token.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(token, "utf8"),
    );
  } catch {
    return false;
  }
}

/** Full public URL for the shop's intake QR, or null if no secret is set. */
export function intakeUrl(origin: string, orgId: string): string | null {
  const k = signOrgIntake(orgId);
  if (!k) return null;
  return `${origin}/i/${orgId}?k=${k}`;
}
