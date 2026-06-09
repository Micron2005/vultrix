import { db } from "@/lib/db";

// Statuses that mean "the shop still has work on the books for this RO".
// INVOICED / PAID / CANCELLED are considered closed — no longer flagged as
// potential duplicates for a new RO.
export const OPEN_RO_STATUSES = [
  "ESTIMATE",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export type OpenROSummary = {
  id: string;
  roNumber: number;
  status: string;
  openedAt: Date;
  complaint: string | null;
  laborDescriptions: string[];
  matchedWords?: string[]; // set when compared against another RO's labor
};

/**
 * Return every open RO for a vehicle, optionally excluding one (the "current"
 * RO whose detail page we're on). Cheap enough to always call — indexed on
 * vehicleId + status.
 */
export async function openROsForVehicle(
  orgId: string,
  vehicleId: string,
  excludeId?: string,
): Promise<OpenROSummary[]> {
  const rows = await db.repairOrder.findMany({
    where: {
      orgId,
      vehicleId,
      status: { in: [...OPEN_RO_STATUSES] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { openedAt: "desc" },
    select: {
      id: true,
      roNumber: true,
      status: true,
      openedAt: true,
      complaint: true,
      laborLines: {
        select: { description: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    roNumber: r.roNumber,
    status: r.status,
    openedAt: r.openedAt,
    complaint: r.complaint,
    laborDescriptions: r.laborLines.map((l) => l.description),
  }));
}

// Statuses that mean "this RO is finished" — useful as history when deciding
// whether a new ticket duplicates work already done on the vehicle.
export const CLOSED_RO_STATUSES = [
  "INVOICED",
  "PAID",
  "CANCELLED",
] as const;

/**
 * Return recent closed (paid / invoiced / cancelled) ROs for a vehicle so the
 * shop can see the car's past work history when starting a new ticket and
 * judge whether it duplicates a previous job.
 */
export async function pastROsForVehicle(
  orgId: string,
  vehicleId: string,
  excludeId?: string,
  limit = 10,
): Promise<OpenROSummary[]> {
  const rows = await db.repairOrder.findMany({
    where: {
      orgId,
      vehicleId,
      status: { in: [...CLOSED_RO_STATUSES] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { openedAt: "desc" },
    take: limit,
    select: {
      id: true,
      roNumber: true,
      status: true,
      openedAt: true,
      complaint: true,
      laborLines: {
        select: { description: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    roNumber: r.roNumber,
    status: r.status,
    openedAt: r.openedAt,
    complaint: r.complaint,
    laborDescriptions: r.laborLines.map((l) => l.description),
  }));
}

// Short filler words the fuzzy match ignores. Anything ≥ 4 chars and not in
// this list counts as a "significant word" for overlap detection.
const STOP_WORDS = new Set([
  "with",
  "from",
  "that",
  "this",
  "they",
  "have",
  "your",
  "into",
  "also",
  "then",
  "than",
  "some",
  "more",
  "just",
  "only",
  "each",
  "over",
  "under",
  "when",
  "what",
  "need",
  "needs",
  "needed",
  "check",
  "checked",
  "work",
  "does",
  "doing",
  "done",
  "front",
  "rear",
  "left",
  "right",
  "both",
  "side",
  "sides",
  "service",
  "services",
  "other",
  "per",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
}

/**
 * Filter open ROs to ones whose labor descriptions share a significant word
 * with any of the labor descriptions of the "current" RO. Returns the same
 * summaries annotated with the matched word(s).
 */
export function filterDuplicatesByLabor(
  candidates: OpenROSummary[],
  currentLaborDescriptions: string[],
): OpenROSummary[] {
  const currentTokens = new Set(
    currentLaborDescriptions.flatMap(tokenize),
  );
  if (currentTokens.size === 0) return [];

  const result: OpenROSummary[] = [];
  for (const ro of candidates) {
    const matched = new Set<string>();
    for (const desc of ro.laborDescriptions) {
      for (const tok of tokenize(desc)) {
        if (currentTokens.has(tok)) matched.add(tok);
      }
    }
    if (matched.size > 0) {
      result.push({ ...ro, matchedWords: Array.from(matched) });
    }
  }
  return result;
}
