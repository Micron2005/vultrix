import type { Prisma, ServiceInterval, ServiceLog, Vehicle } from "@prisma/client";
import { db } from "@/lib/db";

export const DEFAULT_SERVICE_INTERVALS: Array<{
  key: string;
  label: string;
  everyMiles: number | null;
  everyMonths: number | null;
  sortOrder: number;
  keywords: string[];
}> = [
  { key: "oil", label: "Oil change", everyMiles: 5000, everyMonths: 6, sortOrder: 10, keywords: ["oil change", "oil & filter", "oil and filter", "oil/filter", "oil filter"] },
  { key: "tire_rotation", label: "Tire rotation", everyMiles: 7500, everyMonths: null, sortOrder: 20, keywords: ["tire rotation", "rotate tires"] },
  { key: "brake_inspection", label: "Brake inspection", everyMiles: 15000, everyMonths: 12, sortOrder: 30, keywords: ["brake inspection", "brake service", "brake pads", "brake pad", "replace pads", "front brakes", "rear brakes"] },
  { key: "air_filter", label: "Engine air filter", everyMiles: 30000, everyMonths: 36, sortOrder: 40, keywords: ["air filter", "engine air filter"] },
  { key: "cabin_filter", label: "Cabin air filter", everyMiles: 20000, everyMonths: 24, sortOrder: 45, keywords: ["cabin filter", "cabin air filter"] },
  { key: "coolant", label: "Coolant flush", everyMiles: 50000, everyMonths: 60, sortOrder: 50, keywords: ["coolant flush", "coolant service", "radiator flush"] },
  { key: "transmission", label: "Transmission service", everyMiles: 60000, everyMonths: 60, sortOrder: 60, keywords: ["transmission service", "transmission flush", "trans fluid"] },
  { key: "spark_plugs", label: "Spark plugs", everyMiles: 60000, everyMonths: null, sortOrder: 70, keywords: ["spark plug", "spark plugs"] },
];

export async function ensureDefaultServiceIntervals(
  client: Prisma.TransactionClient | typeof db = db,
): Promise<void> {
  for (const d of DEFAULT_SERVICE_INTERVALS) {
    await client.serviceInterval.upsert({
      where: { key: d.key },
      create: {
        key: d.key,
        label: d.label,
        everyMiles: d.everyMiles,
        everyMonths: d.everyMonths,
        sortOrder: d.sortOrder,
      },
      update: {},
    });
  }
}

export type DueStatus = "overdue" | "soon" | "ok";

export interface IntervalDueness {
  interval: ServiceInterval;
  lastLog: ServiceLog | null;
  lastMileage: number | null;
  lastAt: Date | null;
  dueAtMileage: number | null;
  dueByDate: Date | null;
  milesSince: number | null;
  daysSince: number | null;
  milesOver: number | null;
  daysOver: number | null;
  status: DueStatus;
  summary: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SOON_MILES = 500;
const SOON_DAYS = 30;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

export function currentVehicleMileage(
  vehicle: Pick<Vehicle, "mileage" | "createdAt">,
  roMileages: Array<{ mileage: number | null; date: Date }> = [],
): number | null {
  const candidates: number[] = [];
  if (typeof vehicle.mileage === "number") candidates.push(vehicle.mileage);
  for (const r of roMileages) {
    if (typeof r.mileage === "number") candidates.push(r.mileage);
  }
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

export function computeDueness({
  interval,
  lastLog,
  vehicleCreatedAt,
  currentMileage,
  now,
}: {
  interval: ServiceInterval;
  lastLog: ServiceLog | null;
  vehicleCreatedAt: Date;
  currentMileage: number | null;
  now: Date;
}): IntervalDueness {
  const lastMileage = lastLog?.atMileage ?? null;
  const lastAt = lastLog?.performedAt ?? null;

  const dueAtMileage =
    interval.everyMiles != null && lastMileage != null
      ? lastMileage + interval.everyMiles
      : null;

  const baselineDate = lastAt ?? vehicleCreatedAt;
  const dueByDate =
    interval.everyMonths != null
      ? addMonths(baselineDate, interval.everyMonths)
      : null;

  const milesSince =
    currentMileage != null && lastMileage != null
      ? currentMileage - lastMileage
      : null;
  const daysSince = Math.floor(
    (now.getTime() - baselineDate.getTime()) / MS_PER_DAY,
  );

  let milesOver: number | null = null;
  if (dueAtMileage != null && currentMileage != null) {
    milesOver = currentMileage - dueAtMileage;
  }
  let daysOver: number | null = null;
  if (dueByDate != null) {
    daysOver = Math.floor((now.getTime() - dueByDate.getTime()) / MS_PER_DAY);
  }

  let status: DueStatus = "ok";
  if ((milesOver != null && milesOver >= 0) || (daysOver != null && daysOver >= 0)) {
    status = "overdue";
  } else if (
    (milesOver != null && milesOver >= -SOON_MILES) ||
    (daysOver != null && daysOver >= -SOON_DAYS)
  ) {
    status = "soon";
  }

  const pieces: string[] = [];
  if (interval.everyMiles != null) {
    if (lastMileage != null && currentMileage != null) {
      if (status === "overdue" && milesOver != null && milesOver >= 0) {
        pieces.push(`${milesOver.toLocaleString()} mi over`);
      } else if (dueAtMileage != null) {
        const left = dueAtMileage - currentMileage;
        pieces.push(`due in ${left.toLocaleString()} mi`);
      }
    } else {
      pieces.push(`every ${interval.everyMiles.toLocaleString()} mi`);
    }
  }
  if (interval.everyMonths != null && dueByDate != null) {
    if (status === "overdue" && daysOver != null && daysOver >= 0) {
      pieces.push(`${daysOver} days over`);
    } else {
      const daysLeft = Math.max(
        0,
        Math.floor((dueByDate.getTime() - now.getTime()) / MS_PER_DAY),
      );
      pieces.push(`due in ${daysLeft} days`);
    }
  }

  return {
    interval,
    lastLog,
    lastMileage,
    lastAt,
    dueAtMileage,
    dueByDate,
    milesSince,
    daysSince,
    milesOver,
    daysOver,
    status,
    summary: pieces.join(" · "),
  };
}

export interface VehicleWithReminders {
  vehicle: Vehicle;
  items: IntervalDueness[];
  overdueCount: number;
  soonCount: number;
  currentMileage: number | null;
}

export async function computeVehicleReminders(
  orgId: string,
  vehicleId: string,
  now: Date = new Date(),
): Promise<VehicleWithReminders | null> {
  const vehicle = await db.vehicle.findFirst({ where: { id: vehicleId, orgId } });
  if (!vehicle) return null;

  const [intervals, logs, ros] = await Promise.all([
    db.serviceInterval.findMany({
      where: { archived: false },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    db.serviceLog.findMany({
      where: { vehicleId },
      orderBy: { performedAt: "desc" },
    }),
    db.repairOrder.findMany({
      where: { vehicleId, orgId },
      select: { mileageIn: true, mileageOut: true, openedAt: true, completedAt: true },
    }),
  ]);

  const roMileages = ros.flatMap((r) => {
    const out: Array<{ mileage: number | null; date: Date }> = [];
    if (typeof r.mileageIn === "number")
      out.push({ mileage: r.mileageIn, date: r.openedAt });
    if (typeof r.mileageOut === "number")
      out.push({
        mileage: r.mileageOut,
        date: r.completedAt ?? r.openedAt,
      });
    return out;
  });
  const currentMileage = currentVehicleMileage(vehicle, roMileages);

  const items = intervals.map((interval) => {
    const lastLog = logs.find((l) => l.intervalId === interval.id) ?? null;
    return computeDueness({
      interval,
      lastLog,
      vehicleCreatedAt: vehicle.createdAt,
      currentMileage,
      now,
    });
  });

  return {
    vehicle,
    items,
    overdueCount: items.filter((i) => i.status === "overdue").length,
    soonCount: items.filter((i) => i.status === "soon").length,
    currentMileage,
  };
}

export async function computeAllVehicleReminders(
  orgId: string,
  now: Date = new Date(),
): Promise<VehicleWithReminders[]> {
  // Fetch everything we need in 4 queries total, then do the math in-memory.
  // The previous implementation called computeVehicleReminders in a loop,
  // which issued 3 queries per vehicle — with 4,000+ vehicles that's 12,000+
  // sequential round-trips through the Neon pooler, which blows past
  // Vercel's function timeout and makes the dashboard feel hung.
  const [vehicles, intervals, allLogs, allROs] = await Promise.all([
    db.vehicle.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } }),
    db.serviceInterval.findMany({
      where: { archived: false },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    db.serviceLog.findMany({
      where: { vehicle: { orgId } },
      orderBy: { performedAt: "desc" },
    }),
    db.repairOrder.findMany({
      where: { orgId },
      select: {
        vehicleId: true,
        mileageIn: true,
        mileageOut: true,
        openedAt: true,
        completedAt: true,
      },
    }),
  ]);

  const logsByVehicle = new Map<string, ServiceLog[]>();
  for (const l of allLogs) {
    const list = logsByVehicle.get(l.vehicleId) ?? [];
    list.push(l);
    logsByVehicle.set(l.vehicleId, list);
  }

  const roMileagesByVehicle = new Map<
    string,
    Array<{ mileage: number | null; date: Date }>
  >();
  for (const r of allROs) {
    if (!r.vehicleId) continue;
    const list = roMileagesByVehicle.get(r.vehicleId) ?? [];
    if (typeof r.mileageIn === "number")
      list.push({ mileage: r.mileageIn, date: r.openedAt });
    if (typeof r.mileageOut === "number")
      list.push({
        mileage: r.mileageOut,
        date: r.completedAt ?? r.openedAt,
      });
    roMileagesByVehicle.set(r.vehicleId, list);
  }

  const out: VehicleWithReminders[] = [];
  for (const vehicle of vehicles) {
    const logs = logsByVehicle.get(vehicle.id) ?? [];
    const roMileages = roMileagesByVehicle.get(vehicle.id) ?? [];
    const currentMileage = currentVehicleMileage(vehicle, roMileages);
    const items = intervals.map((interval) => {
      const lastLog = logs.find((l) => l.intervalId === interval.id) ?? null;
      return computeDueness({
        interval,
        lastLog,
        vehicleCreatedAt: vehicle.createdAt,
        currentMileage,
        now,
      });
    });
    out.push({
      vehicle,
      items,
      overdueCount: items.filter((i) => i.status === "overdue").length,
      soonCount: items.filter((i) => i.status === "soon").length,
      currentMileage,
    });
  }
  return out;
}

export function matchIntervalFromDescription(
  description: string,
): string | null {
  const needle = description.toLowerCase();
  for (const d of DEFAULT_SERVICE_INTERVALS) {
    for (const k of d.keywords) {
      if (needle.includes(k)) return d.key;
    }
  }
  return null;
}

export async function autoLogServicesForRO(
  repairOrderId: string,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<number> {
  const ro = await client.repairOrder.findUnique({
    where: { id: repairOrderId },
    include: { laborLines: true },
  });
  if (!ro) return 0;
  if (!ro.vehicleId) return 0;

  const intervals = await client.serviceInterval.findMany({
    where: { archived: false },
  });
  const byKey = new Map(intervals.map((i) => [i.key, i]));

  const matched = new Set<string>();
  for (const line of ro.laborLines) {
    const key = matchIntervalFromDescription(line.description);
    if (key) matched.add(key);
  }
  if (matched.size === 0) return 0;

  const performedAt = ro.completedAt ?? ro.paidAt ?? new Date();
  const atMileage = ro.mileageOut ?? ro.mileageIn ?? null;

  let created = 0;
  for (const key of matched) {
    const interval = byKey.get(key);
    if (!interval) continue;
    const existing = await client.serviceLog.findFirst({
      where: {
        vehicleId: ro.vehicleId,
        intervalId: interval.id,
        performedAt,
      },
    });
    if (existing) continue;
    await client.serviceLog.create({
      data: {
        vehicleId: ro.vehicleId,
        intervalId: interval.id,
        performedAt,
        atMileage,
        source: "auto",
        note: `RO #${ro.roNumber}`,
      },
    });
    created++;
  }
  return created;
}
