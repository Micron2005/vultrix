/**
 * Product branding for the hosted platform. These are the platform-wide names
 * (the SaaS itself), not a tenant's shop name — each business sets its own shop
 * name, which is what they see once logged in. Override via env at deploy time.
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Vultrixx";

export const APP_OWNER =
  process.env.NEXT_PUBLIC_APP_OWNER?.trim() || "M.S.A.M Industries";

/** e.g. "Vultrixx is owned by M.S.A.M Industries" */
export const APP_OWNER_LINE = `${APP_NAME} is owned by ${APP_OWNER}`;
