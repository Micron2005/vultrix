import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { dbBase } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

type VehicleLookupRow = {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  engine: string | null;
  vin: string | null;
  licensePlate: string | null;
  licenseState: string | null;
  customerName: string | null;
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (user.accountType !== "AUTO_SHOP" || !user.orgId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (query.length < 2) return NextResponse.json([]);

  const normalized = query.toLowerCase().replace(/[^a-z0-9]/g, "");
  const textPattern = `%${query.toLowerCase()}%`;
  const platePattern = normalized
    ? `%${normalized}%`
    : "%__no_plate_match__%";

  const vehicles = await dbBase.$queryRaw<VehicleLookupRow[]>(Prisma.sql`
    SELECT
      v."id",
      v."year",
      v."make",
      v."model",
      v."engine",
      v."vin",
      v."licensePlate",
      v."licenseState",
      COALESCE(
        NULLIF(c."companyName", ''),
        NULLIF(TRIM(CONCAT(c."firstName", ' ', c."lastName")), '')
      ) AS "customerName"
    FROM "Vehicle" v
    INNER JOIN "Customer" c ON c."id" = v."customerId"
    WHERE v."orgId" = ${user.orgId}
      AND (
        LOWER(REGEXP_REPLACE(COALESCE(v."licensePlate", ''), '[^a-zA-Z0-9]', '', 'g'))
          LIKE ${platePattern}
        OR LOWER(COALESCE(v."vin", '')) LIKE ${textPattern}
        OR LOWER(COALESCE(c."firstName", '')) LIKE ${textPattern}
        OR LOWER(COALESCE(c."lastName", '')) LIKE ${textPattern}
        OR LOWER(COALESCE(c."companyName", '')) LIKE ${textPattern}
      )
    ORDER BY v."updatedAt" DESC
    LIMIT 8
  `);

  return NextResponse.json(vehicles);
}
