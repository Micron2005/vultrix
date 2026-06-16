/**
 * Product branding for the hosted platform. These are the platform-wide names
 * (the SaaS itself), not a tenant's shop name — each business sets its own shop
 * name, which is what they see once logged in. Override via env at deploy time.
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Vultrix";

export const APP_OWNER =
  process.env.NEXT_PUBLIC_APP_OWNER?.trim() || "M.S.A.M Industries";

/** e.g. "Vultrix is owned by M.S.A.M Industries" */
export const APP_OWNER_LINE = `${APP_NAME} is owned by ${APP_OWNER}`;

/** Contact address shown on the legal pages and used for legal notices. */
export const LEGAL_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() || "support@vultrix.net";

/** Jurisdiction whose law governs the Terms (override per deploy). */
export const LEGAL_GOVERNING_LAW =
  process.env.NEXT_PUBLIC_LEGAL_GOVERNING_LAW?.trim() ||
  "the State of Texas, United States";

/** Last-updated date shown on the legal pages. */
export const LEGAL_LAST_UPDATED =
  process.env.NEXT_PUBLIC_LEGAL_LAST_UPDATED?.trim() || "June 16, 2026";
