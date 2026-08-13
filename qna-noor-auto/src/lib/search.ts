import { Prisma } from "@prisma/client";
import { dbBase } from "@/lib/db";

export type NormalizedSearchMatches = {
  customerIdsByToken: string[][];
  vehicleIdsByToken: string[][];
};

function uniqueIds(rows: Array<{ id: string }>) {
  return [...new Set(rows.map((row) => row.id))];
}

export function normalizePhoneToken(token: string) {
  const digits = token.replace(/[^0-9]/g, "");
  return digits.length >= 3 ? digits : null;
}

export function normalizeVehicleToken(token: string) {
  const value = token.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return value || null;
}

async function customerIdsForPhone(orgId: string, token: string) {
  const digits = normalizePhoneToken(token);
  if (!digits) return [];

  const rows = await dbBase.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "Customer"
    WHERE "orgId" = ${orgId}
      AND (
        regexp_replace(COALESCE("phone", ''), '[^0-9]', '', 'g')
          LIKE ${`%${digits}%`}
        OR regexp_replace(COALESCE("altPhone", ''), '[^0-9]', '', 'g')
          LIKE ${`%${digits}%`}
      )
    UNION
    SELECT DISTINCT "customerId" AS id
    FROM "CustomerContact"
    WHERE "orgId" = ${orgId}
      AND "kind" = 'PHONE'
      AND regexp_replace(COALESCE("value", ''), '[^0-9]', '', 'g')
        LIKE ${`%${digits}%`}
  `);

  return uniqueIds(rows);
}

async function vehicleIdsForToken(orgId: string, token: string) {
  const normalized = normalizeVehicleToken(token);
  if (!normalized) return [];

  const pattern = `%${normalized}%`;
  const rows = await dbBase.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "Vehicle"
    WHERE "orgId" = ${orgId}
      AND (
        lower(regexp_replace(COALESCE("licensePlate", ''), '[^a-zA-Z0-9]', '', 'g'))
          LIKE ${pattern}
        OR lower(regexp_replace(COALESCE("vin", ''), '[^a-zA-Z0-9]', '', 'g'))
          LIKE ${pattern}
        OR lower(regexp_replace(COALESCE("unitNumber", ''), '[^a-zA-Z0-9]', '', 'g'))
          LIKE ${pattern}
      )
  `);

  return uniqueIds(rows);
}

export async function findNormalizedSearchMatches(
  orgId: string,
  tokens: string[],
): Promise<NormalizedSearchMatches> {
  const matches = await Promise.all(
    tokens.map(async (token) => ({
      customerIds: await customerIdsForPhone(orgId, token),
      vehicleIds: await vehicleIdsForToken(orgId, token),
    })),
  );

  return {
    customerIdsByToken: matches.map((match) => match.customerIds),
    vehicleIdsByToken: matches.map((match) => match.vehicleIds),
  };
}
