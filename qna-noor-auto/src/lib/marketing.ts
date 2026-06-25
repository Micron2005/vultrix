import { db } from "./db";

/**
 * Whether the given organization is the platform owner's OWN shop — the only
 * tenant allowed to see internal sales tools (e.g. the marketing flyer).
 *
 * Resolution order:
 *   1. MARKETING_FLYER_ORG_ID env var (explicit), when set.
 *   2. Otherwise the first/oldest organization — the owner's shop, since every
 *      customer shop signs up afterward.
 *
 * Platform SUPERADMINs (who have no org) are handled separately by the caller.
 */
export async function isMarketingOwnerOrg(
  orgId: string | null | undefined,
): Promise<boolean> {
  if (!orgId) return false;

  const configured = process.env.MARKETING_FLYER_ORG_ID?.trim();
  if (configured) return orgId === configured;

  const oldest = await db.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return !!oldest && orgId === oldest.id;
}
