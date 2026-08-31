import { db } from "@/lib/db";
import { isValidTimeZone } from "@/lib/timezone";

export async function orgTimeZone(orgId: string): Promise<string> {
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: { timezone: true },
  });
  return organization && isValidTimeZone(organization.timezone)
    ? organization.timezone
    : "America/New_York";
}
