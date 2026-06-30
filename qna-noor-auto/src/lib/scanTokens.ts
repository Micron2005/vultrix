import crypto from "node:crypto";

/**
 * Short signed token embedded in QR sticker URLs so the unauthenticated
 * quick-scan flow (`/q/<id>?k=<token>`) can't be abused by guessing part
 * ids. The token is HMAC-SHA256(partId, secret) truncated to 16 hex chars.
 *
 * If `STOCK_SCAN_SIGNING_SECRET` is unset, no token is produced and the
 * QR generator should fall back to the login-gated `/s/<id>` URL.
 */
export function signPartId(id: string): string | null {
  const secret = process.env.STOCK_SCAN_SIGNING_SECRET;
  if (!secret) return null;
  return crypto
    .createHmac("sha256", secret)
    .update(id)
    .digest("hex")
    .slice(0, 16);
}

export function verifyPartToken(id: string, token: string): boolean {
  const expected = signPartId(id);
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

/**
 * Picks the sticker URL to embed in a QR code.
 *
 *   - If the scan-signing secret is configured, returns
 *     `${origin}/q/<id>?k=<token>` (no login required, auto-subtracts 1).
 *   - Otherwise falls back to the login-gated `/s/<id>` landing.
 */
export function stickerScanUrl(origin: string, id: string): string {
  const base = origin || "";
  const k = signPartId(id);
  if (k) return `${base}/q/${id}?k=${k}`;
  return `${base}/s/${id}`;
}

/**
 * URL for a shelf/bin QR sticker. Scanning it opens the login-gated `/sl/<loc>`
 * page, which lists every part stored at that location so the tech can tap the
 * one they used. No signing token is needed because the page itself requires a
 * session and scopes results to the signed-in org.
 */
export function locationScanUrl(origin: string, location: string): string {
  const base = origin || "";
  return `${base}/sl/${encodeURIComponent(location)}`;
}
