import { NextResponse } from "next/server";

// NHTSA vPIC — free, no API key required.
// DecodeVinValuesExtended returns a flat object with ~130 fields; we keep the
// ones shops actually care about.
const NHTSA_URL =
  "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended";

const FIELDS: Array<[string, string]> = [
  ["ModelYear", "Year"],
  ["Make", "Make"],
  ["Model", "Model"],
  ["Trim", "Trim"],
  ["Series", "Series"],
  ["BodyClass", "Body"],
  ["VehicleType", "Vehicle type"],
  ["DriveType", "Drive type"],
  ["TransmissionStyle", "Transmission"],
  ["TransmissionSpeeds", "Transmission speeds"],
  ["EngineConfiguration", "Engine configuration"],
  ["EngineCylinders", "Cylinders"],
  ["DisplacementL", "Displacement (L)"],
  ["DisplacementCI", "Displacement (CI)"],
  ["EngineHP", "Horsepower"],
  ["FuelTypePrimary", "Fuel type"],
  ["FuelTypeSecondary", "Secondary fuel"],
  ["Doors", "Doors"],
  ["Seats", "Seats"],
  ["GVWR", "GVWR"],
  ["BrakeSystemType", "Brake system"],
  ["PlantCity", "Plant city"],
  ["PlantState", "Plant state"],
  ["PlantCountry", "Plant country"],
  ["Manufacturer", "Manufacturer"],
  ["Note", "Note"],
  ["ErrorText", "Error text"],
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("vin") ?? "").trim().toUpperCase();
  // Strip common confusables. VINs never contain I, O, or Q.
  const vin = raw.replace(/[\s-]/g, "");

  if (!vin) {
    return NextResponse.json(
      { error: "Missing vin parameter" },
      { status: 400 },
    );
  }
  if (vin.length !== 17) {
    return NextResponse.json(
      { error: `VIN must be 17 characters (got ${vin.length})` },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${NHTSA_URL}/${encodeURIComponent(vin)}?format=json`, {
      // NHTSA is public and doesn't need auth; cache a day to be nice.
      next: { revalidate: 86400 },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Failed to reach NHTSA",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `NHTSA returned ${res.status}` },
      { status: 502 },
    );
  }

  const data = (await res.json()) as {
    Results?: Array<Record<string, string>>;
  };
  const first = data.Results?.[0];
  if (!first) {
    return NextResponse.json({ error: "Empty NHTSA response" }, { status: 502 });
  }

  // Build a tidy subset. Many values come back as empty strings — skip those.
  const details: Array<{ label: string; value: string }> = [];
  for (const [key, label] of FIELDS) {
    const value = String(first[key] ?? "").trim();
    if (value) details.push({ label, value });
  }

  // Derive a one-line summary ("2017 Toyota Camry LE").
  const year = first.ModelYear?.trim();
  const make = first.Make?.trim();
  const model = first.Model?.trim();
  const trim = first.Trim?.trim();
  const summary = [year, make, model, trim].filter(Boolean).join(" ");

  const errorCode = String(first.ErrorCode ?? "").trim();
  // "0" = success, "6" = success with fallback, both are usable.
  const hasUsefulData = Boolean(year || make || model);

  return NextResponse.json({
    vin,
    summary,
    year: year || null,
    make: make || null,
    model: model || null,
    trim: trim || null,
    details,
    errorCode,
    errorText: String(first.ErrorText ?? "").trim(),
    hasData: hasUsefulData,
  });
}
