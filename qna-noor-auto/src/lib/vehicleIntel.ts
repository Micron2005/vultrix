import { db } from "@/lib/db";
import { decodeVin } from "@/lib/vin";
import {
  fetchRecallsFromNhtsa,
  parseCachedRecalls,
  type CachedRecalls,
} from "@/lib/nhtsa";
import { findNotesForVehicle } from "@/lib/notes";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type IntelSpec = {
  year: number;
  make: string;
  model: string;
  engine?: string | null;
};

export type ComplaintGroup = {
  component: string;
  count: number;
  samples: {
    odiNumber: number;
    dateOfIncident: string;
    summary: string;
    crash: boolean;
    fire: boolean;
  }[];
};

export type IntelComplaints = {
  total: number;
  groups: ComplaintGroup[];
  fetchedAt: string;
};

export type KnownFix = {
  source: "note" | "ro";
  id: string;
  title: string;
  symptom: string | null;
  cause: string | null;
  fix: string | null;
  parts: string | null;
  laborHours: number | null;
  year: number | null;
  mileage: number | null;
  engine: string | null;
  date: string;
  href: string | null;
  community: boolean;
};

function cacheKey(spec: IntelSpec) {
  return {
    kind_year_make_model: {
      kind: "complaints",
      year: spec.year,
      make: spec.make.trim().toLowerCase(),
      model: spec.model.trim().toLowerCase(),
    },
  };
}

function cacheWhere(kind: string, spec: IntelSpec) {
  return {
    kind_year_make_model: {
      kind,
      year: spec.year,
      make: spec.make.trim().toLowerCase(),
      model: spec.model.trim().toLowerCase(),
    },
  };
}

function cacheIsFresh(fetchedAt: Date) {
  return Date.now() - fetchedAt.getTime() < CACHE_TTL_MS;
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function truncate(value: string, max = 280) {
  const text = value.trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return ["true", "yes", "y", "1"].includes(String(value).toLowerCase());
}

function parseComplaints(raw: string | null): IntelComplaints | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as IntelComplaints;
    if (
      parsed &&
      typeof parsed.total === "number" &&
      Array.isArray(parsed.groups) &&
      typeof parsed.fetchedAt === "string"
    ) {
      return parsed;
    }
  } catch {
    // Ignore malformed cache entries.
  }
  return null;
}

async function saveCache(
  kind: string,
  spec: IntelSpec,
  value: unknown,
  fetchedAt = new Date(),
) {
  await db.vehicleIntelCache.upsert({
    where: cacheWhere(kind, spec),
    create: {
      kind,
      year: spec.year,
      make: spec.make.trim().toLowerCase(),
      model: spec.model.trim().toLowerCase(),
      json: JSON.stringify(value),
      fetchedAt,
    },
    update: {
      json: JSON.stringify(value),
      fetchedAt,
    },
  });
}

export async function loadComplaints(
  spec: IntelSpec,
): Promise<IntelComplaints | null> {
  const cachedRow = await db.vehicleIntelCache.findUnique({
    where: cacheKey(spec),
  });
  const cached = parseComplaints(cachedRow?.json ?? null);
  if (cachedRow && cached && cacheIsFresh(cachedRow.fetchedAt)) {
    return cached;
  }

  const url = `https://api.nhtsa.gov/complaints/complaintsByVehicle?make=${encodeURIComponent(
    spec.make,
  )}&model=${encodeURIComponent(spec.model)}&modelYear=${spec.year}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`NHTSA returned ${response.status}`);
    const data = (await response.json()) as {
      count?: number;
      results?: Array<{
        odiNumber?: number;
        dateOfIncident?: string;
        summary?: string;
        components?: string;
        crash?: unknown;
        fire?: unknown;
      }>;
    };
    const grouped = new Map<string, ComplaintGroup>();
    for (const result of data.results ?? []) {
      const rawComponent = result.components?.split(",")[0]?.trim() || "Unknown";
      const component = titleCase(rawComponent);
      const group = grouped.get(component) ?? {
        component,
        count: 0,
        samples: [],
      };
      group.count += 1;
      if (group.samples.length < 3) {
        group.samples.push({
          odiNumber: Number(result.odiNumber ?? 0),
          dateOfIncident: result.dateOfIncident ?? "",
          summary: truncate(result.summary ?? ""),
          crash: asBoolean(result.crash),
          fire: asBoolean(result.fire),
        });
      }
      grouped.set(component, group);
    }
    const fetchedAt = new Date().toISOString();
    const value: IntelComplaints = {
      total: Number(data.count ?? data.results?.length ?? 0),
      groups: Array.from(grouped.values()).sort((a, b) => b.count - a.count),
      fetchedAt,
    };
    await saveCache("complaints", spec, value, new Date(fetchedAt));
    return value;
  } catch {
    return cached;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadRecalls(
  spec: IntelSpec,
): Promise<CachedRecalls | null> {
  const cachedRow = await db.vehicleIntelCache.findUnique({
    where: cacheWhere("recalls", spec),
  });
  const cached = parseCachedRecalls(cachedRow?.json ?? null);
  if (cachedRow && cached && cacheIsFresh(cachedRow.fetchedAt)) {
    return cached;
  }

  const fresh = await fetchRecallsFromNhtsa(spec.year, spec.make, spec.model);
  if (!fresh) return cached;
  await saveCache("recalls", spec, fresh, new Date(fresh.fetchedAt));
  return fresh;
}

function repairOrderDate(ro: {
  closedAt: Date | null;
  completedAt: Date | null;
  invoicedAt: Date | null;
  paidAt: Date | null;
  openedAt: Date;
}) {
  return (
    ro.closedAt ??
    ro.completedAt ??
    ro.invoicedAt ??
    ro.paidAt ??
    ro.openedAt
  );
}

function complaintTitle(complaint: string | null, roNumber: number) {
  const firstLine = complaint?.split(/\r?\n/, 1)[0]?.trim();
  return firstLine || `RO #${roNumber}`;
}

function mapNote(note: {
  id: string;
  title: string;
  symptom: string | null;
  diagnosis: string | null;
  fix: string | null;
  partsNotes: string | null;
  laborHoursEstimate: number | null;
  yearMin: number | null;
  yearMax: number | null;
  engine: string | null;
  updatedAt: Date;
}, community: boolean): KnownFix {
  return {
    source: "note",
    id: note.id,
    title: note.title,
    symptom: note.symptom,
    cause: note.diagnosis,
    fix: note.fix,
    parts: note.partsNotes,
    laborHours: note.laborHoursEstimate,
    year: note.yearMin ?? note.yearMax,
    mileage: null,
    engine: note.engine,
    date: note.updatedAt.toISOString(),
    href: community ? null : `/notes/${note.id}`,
    community,
  };
}

function mapRepairOrder(
  ro: {
    id: string;
    roNumber: number;
    complaint: string | null;
    cause: string | null;
    correction: string | null;
    mileageIn: number | null;
    openedAt: Date;
    closedAt: Date | null;
    completedAt: Date | null;
    invoicedAt: Date | null;
    paidAt: Date | null;
    vehicle: {
      year: number | null;
      engine: string | null;
    } | null;
  },
  community: boolean,
): KnownFix {
  const date = repairOrderDate(ro);
  return {
    source: "ro",
    id: ro.id,
    title: complaintTitle(ro.complaint, ro.roNumber),
    symptom: ro.complaint,
    cause: ro.cause,
    fix: ro.correction,
    parts: null,
    laborHours: null,
    year: ro.vehicle?.year ?? null,
    mileage: ro.mileageIn,
    engine: ro.vehicle?.engine ?? null,
    date: date.toISOString(),
    href: community ? null : `/repair-orders/${ro.id}`,
    community,
  };
}

function noteMatchesYear(
  note: { yearMin: number | null; yearMax: number | null },
  year: number,
) {
  if (note.yearMin != null && year < note.yearMin) return false;
  if (note.yearMax != null && year > note.yearMax) return false;
  return true;
}

function sortFixes(
  fixes: KnownFix[],
  spec: IntelSpec,
) {
  return fixes
    .sort((a, b) => {
      const aExact = a.year === spec.year ? 1 : 0;
      const bExact = b.year === spec.year ? 1 : 0;
      return (
        bExact - aExact ||
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    })
    .slice(0, 100);
}

function sortNewest(fixes: KnownFix[]) {
  return fixes
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 100);
}

export async function loadOwnFixes(
  orgId: string,
  spec: IntelSpec,
): Promise<KnownFix[]> {
  const [notes, repairOrders] = await Promise.all([
    findNotesForVehicle(orgId, spec),
    db.repairOrder.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: { in: ["COMPLETED", "INVOICED", "PAID"] },
        OR: [{ cause: { not: null } }, { correction: { not: null } }],
        vehicle: {
          make: { equals: spec.make, mode: "insensitive" },
          model: { equals: spec.model, mode: "insensitive" },
        },
      },
      include: {
        vehicle: {
          select: { year: true, engine: true },
        },
      },
      orderBy: { openedAt: "desc" },
      take: 100,
    }),
  ]);

  return sortFixes(
    [
      ...notes.map((note) => mapNote(note, false)),
      ...repairOrders.map((ro) => mapRepairOrder(ro, false)),
    ],
    spec,
  );
}

export async function loadCommunityFixes(
  orgId: string,
  spec: IntelSpec,
): Promise<KnownFix[]> {
  const sharingOrg = await db.organization.findUnique({
    where: { id: orgId },
    select: { shareFixes: true },
  });
  if (!sharingOrg?.shareFixes) return [];

  const [notes, repairOrders] = await Promise.all([
    db.repairNote.findMany({
      where: {
        orgId: { not: orgId },
        shared: true,
        organization: { shareFixes: true, status: "ACTIVE" },
        make: { equals: spec.make, mode: "insensitive" },
        model: { equals: spec.model, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.repairOrder.findMany({
      where: {
        orgId: { not: orgId },
        deletedAt: null,
        status: { in: ["COMPLETED", "INVOICED", "PAID"] },
        OR: [{ cause: { not: null } }, { correction: { not: null } }],
        organization: { shareFixes: true, status: "ACTIVE" },
        vehicle: {
          make: { equals: spec.make, mode: "insensitive" },
          model: { equals: spec.model, mode: "insensitive" },
        },
      },
      include: {
        vehicle: {
          select: { year: true, engine: true },
        },
      },
      orderBy: { openedAt: "desc" },
      take: 100,
    }),
  ]);

  return sortNewest(
    [
      ...notes
        .filter((note) => noteMatchesYear(note, spec.year))
        .map((note) => mapNote(note, true)),
      ...repairOrders.map((ro) => mapRepairOrder(ro, true)),
    ],
  );
}

export async function resolveSpec(params: {
  vin?: string | null;
  year?: string | number | null;
  make?: string | null;
  model?: string | null;
  engine?: string | null;
}): Promise<IntelSpec | null> {
  let year = Number(params.year);
  let make = typeof params.make === "string" ? params.make.trim() : "";
  let model = typeof params.model === "string" ? params.model.trim() : "";
  let engine = typeof params.engine === "string" ? params.engine.trim() : "";
  const vin = typeof params.vin === "string" ? params.vin.replace(/[\s-]/g, "") : "";

  if (vin.length === 17) {
    try {
      const decoded = await decodeVin(vin);
      year ||= decoded.year ?? 0;
      make ||= decoded.make ?? "";
      model ||= decoded.model ?? "";
      engine ||= decoded.engine ?? "";
    } catch {
      // Manual year/make/model values can still resolve if VIN lookup fails.
    }
  }

  if (!Number.isInteger(year) || year < 1886 || year > 2100 || !make || !model) {
    return null;
  }
  return {
    year,
    make,
    model,
    engine: engine || null,
  };
}
