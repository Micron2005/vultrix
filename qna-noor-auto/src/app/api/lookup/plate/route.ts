import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Search existing vehicle records by license plate.
// Match is case-insensitive. Optional state filter narrows to a single DMV
// (plate numbers are only unique within a state, not nationally).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const plate = (url.searchParams.get("plate") ?? "").trim();
  const state = (url.searchParams.get("state") ?? "").trim().toUpperCase();

  if (!plate) {
    return NextResponse.json(
      { error: "Missing plate parameter" },
      { status: 400 },
    );
  }

  // Normalize the user's input: uppercase, remove spaces and dashes so
  // "AB-1234", "AB 1234", "ab1234" all match the stored "AB1234".
  const normalized = plate.toUpperCase().replace(/[\s-]/g, "");

  const vehicles = await db.vehicle.findMany({
    where: {
      licensePlate: { not: null },
      ...(state ? { licenseState: state } : {}),
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          companyName: true,
          phone: true,
          email: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const matches = vehicles.filter((v) => {
    const stored = (v.licensePlate ?? "").toUpperCase().replace(/[\s-]/g, "");
    return stored === normalized;
  });

  return NextResponse.json({
    plate: normalized,
    state: state || null,
    count: matches.length,
    matches: matches.map((v) => ({
      id: v.id,
      year: v.year,
      make: v.make,
      model: v.model,
      trim: v.trim,
      vin: v.vin,
      licensePlate: v.licensePlate,
      licenseState: v.licenseState,
      color: v.color,
      mileage: v.mileage,
      customerId: v.customerId,
      customer: v.customer,
    })),
  });
}
