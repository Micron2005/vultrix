/**
 * NHTSA vPIC VIN decoder (free, no key required).
 * https://vpic.nhtsa.dot.gov/api/
 */

export type VinDecodeResult = {
  vin: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  engine?: string;
  transmission?: string;
  drivetrain?: string;
  bodyStyle?: string;
  errorText?: string;
  raw?: Record<string, string>;
};

type NhtsaResult = {
  Variable: string;
  Value: string | null;
  ValueId?: string | null;
};

function clean(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  const t = v.trim();
  if (!t || t === "Not Applicable" || t === "0" || t === "null") return undefined;
  return t;
}

export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  const v = vin.trim().toUpperCase();
  if (v.length < 11) {
    return { vin: v, errorText: "VIN must be at least 11 characters" };
  }
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(
    v,
  )}?format=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return { vin: v, errorText: `NHTSA API returned ${res.status}` };
  }
  const data = (await res.json()) as { Results: NhtsaResult[] };

  const raw: Record<string, string> = {};
  for (const r of data.Results) {
    if (r.Value && r.Variable) raw[r.Variable] = r.Value;
  }

  const yearStr = clean(raw["Model Year"]);
  const year = yearStr ? parseInt(yearStr, 10) : undefined;

  const engineParts = [
    clean(raw["Displacement (L)"]) ? `${clean(raw["Displacement (L)"])}L` : undefined,
    clean(raw["Engine Number of Cylinders"])
      ? `${clean(raw["Engine Number of Cylinders"])}cyl`
      : undefined,
    clean(raw["Fuel Type - Primary"]),
    clean(raw["Engine Configuration"]),
  ].filter(Boolean);

  return {
    vin: v,
    year: year && !isNaN(year) ? year : undefined,
    make: clean(raw["Make"]),
    model: clean(raw["Model"]),
    trim: clean(raw["Trim"]) ?? clean(raw["Series"]),
    engine: engineParts.length ? engineParts.join(" ") : undefined,
    transmission:
      clean(raw["Transmission Style"]) ??
      clean(raw["Transmission Speeds"]),
    drivetrain: clean(raw["Drive Type"]),
    bodyStyle: clean(raw["Body Class"]),
    errorText: clean(raw["Error Text"]),
    raw,
  };
}
