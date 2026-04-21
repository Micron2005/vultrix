import { db } from "./db";

export type NhtsaRecall = {
  NHTSACampaignNumber: string;
  Manufacturer?: string;
  ReportReceivedDate?: string;
  Component?: string;
  Summary?: string;
  Consequence?: string;
  Remedy?: string;
  Notes?: string;
};

export type CachedRecalls = {
  year: number;
  make: string;
  model: string;
  fetchedAt: string;
  count: number;
  recalls: NhtsaRecall[];
};

export function parseCachedRecalls(raw: string | null): CachedRecalls | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.recalls)
    ) {
      return parsed as CachedRecalls;
    }
  } catch {
    // ignore
  }
  return null;
}

// Fetches recalls from the free NHTSA API. Returns null if any required field
// is missing or the fetch fails (caller can show a gentle message in that case).
export async function fetchRecallsFromNhtsa(
  year: number,
  make: string,
  model: string,
): Promise<CachedRecalls | null> {
  if (!year || !make || !model) return null;
  const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(
    make,
  )}&model=${encodeURIComponent(model)}&modelYear=${year}`;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      // Don't cache on the Next.js side; we do our own DB caching.
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      Count?: number;
      results?: NhtsaRecall[];
    };
    return {
      year,
      make,
      model,
      fetchedAt: new Date().toISOString(),
      count: data.Count ?? (data.results?.length ?? 0),
      recalls: data.results ?? [],
    };
  } catch {
    return null;
  }
}

export async function refreshVehicleRecalls(
  vehicleId: string,
): Promise<CachedRecalls | null> {
  const v = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { year: true, make: true, model: true },
  });
  if (!v || !v.year || !v.make || !v.model) return null;
  const cached = await fetchRecallsFromNhtsa(v.year, v.make, v.model);
  if (!cached) return null;
  await db.vehicle.update({
    where: { id: vehicleId },
    data: {
      recallsJson: JSON.stringify(cached),
      recallsFetchedAt: new Date(),
    },
  });
  return cached;
}
