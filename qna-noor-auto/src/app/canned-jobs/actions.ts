"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { getSetting } from "@/lib/shop";

function cleanStr(s: FormDataEntryValue | null): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

function parseNum(raw: FormDataEntryValue | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

type LaborRow = {
  description: string;
  hours: number;
  rate: number | null;
};
type PartRow = {
  partId: string | null;
  partNumber: string | null;
  description: string;
  quantity: number;
  unitPrice: number | null;
};

function extractLaborRows(fd: FormData): LaborRow[] {
  const descs = fd.getAll("laborDescription[]");
  const hours = fd.getAll("laborHours[]");
  const rates = fd.getAll("laborRate[]");
  const rows: LaborRow[] = [];
  for (let i = 0; i < descs.length; i++) {
    const d = cleanStr(descs[i]);
    if (!d) continue;
    rows.push({
      description: d,
      hours: parseNum(hours[i]) ?? 0,
      rate: parseNum(rates[i]),
    });
  }
  return rows;
}

function extractPartRows(fd: FormData): PartRow[] {
  const partIds = fd.getAll("partId[]");
  const partNumbers = fd.getAll("partNumber[]");
  const descs = fd.getAll("partDescription[]");
  const qtys = fd.getAll("partQty[]");
  const prices = fd.getAll("partUnitPrice[]");
  const rows: PartRow[] = [];
  for (let i = 0; i < descs.length; i++) {
    const d = cleanStr(descs[i]);
    if (!d) continue;
    rows.push({
      partId: cleanStr(partIds[i]),
      partNumber: cleanStr(partNumbers[i]),
      description: d,
      quantity: parseNum(qtys[i]) ?? 1,
      unitPrice: parseNum(prices[i]),
    });
  }
  return rows;
}

export async function createCannedJob(fd: FormData) {
  const orgId = await requireOrgId();
  const name = cleanStr(fd.get("name"));
  if (!name) throw new Error("Name is required");
  const labor = extractLaborRows(fd);
  const parts = extractPartRows(fd);
  const job = await db.cannedJob.create({
    data: {
      orgId,
      name,
      description: cleanStr(fd.get("description")),
      category: cleanStr(fd.get("category")),
      notes: cleanStr(fd.get("notes")),
      laborItems: {
        create: labor.map((l, i) => ({
          description: l.description,
          hours: l.hours,
          rate: l.rate,
          sortOrder: i,
        })),
      },
      partItems: {
        create: parts.map((p, i) => ({
          partId: p.partId,
          partNumber: p.partNumber,
          description: p.description,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          sortOrder: i,
        })),
      },
    },
  });
  revalidatePath("/canned-jobs");
  redirect(`/canned-jobs/${job.id}`);
}

export async function updateCannedJob(id: string, fd: FormData) {
  const orgId = await requireOrgId();
  const name = cleanStr(fd.get("name"));
  if (!name) throw new Error("Name is required");
  const owned = await db.cannedJob.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  if (!owned) throw new Error("Preset not found");
  const labor = extractLaborRows(fd);
  const parts = extractPartRows(fd);
  await db.$transaction([
    db.cannedJob.update({
      where: { id },
      data: {
        name,
        description: cleanStr(fd.get("description")),
        category: cleanStr(fd.get("category")),
        notes: cleanStr(fd.get("notes")),
        archived: fd.get("archived") === "on",
      },
    }),
    db.cannedJobLabor.deleteMany({ where: { cannedJobId: id } }),
    db.cannedJobPart.deleteMany({ where: { cannedJobId: id } }),
    db.cannedJobLabor.createMany({
      data: labor.map((l, i) => ({
        cannedJobId: id,
        description: l.description,
        hours: l.hours,
        rate: l.rate,
        sortOrder: i,
      })),
    }),
    db.cannedJobPart.createMany({
      data: parts.map((p, i) => ({
        cannedJobId: id,
        partId: p.partId,
        partNumber: p.partNumber,
        description: p.description,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        sortOrder: i,
      })),
    }),
  ]);
  revalidatePath("/canned-jobs");
  revalidatePath(`/canned-jobs/${id}`);
  redirect(`/canned-jobs/${id}`);
}

export async function deleteCannedJob(id: string) {
  const orgId = await requireOrgId();
  await db.cannedJob.deleteMany({ where: { id, orgId } });
  revalidatePath("/canned-jobs");
  redirect("/canned-jobs");
}

// Apply a canned job to a repair order. Copies labor and parts lines onto the RO.
// Catalog-linked parts decrement stock (same discipline as normal part-line creation).
export async function applyCannedJobToRepairOrder(
  roId: string,
  jobId: string,
) {
  const orgId = await requireOrgId();
  const job = await db.cannedJob.findFirst({
    where: { id: jobId, orgId },
    include: {
      laborItems: { orderBy: { sortOrder: "asc" } },
      partItems: {
        orderBy: { sortOrder: "asc" },
        include: { part: true },
      },
    },
  });
  if (!job) throw new Error("Preset not found");

  const ro = await db.repairOrder.findFirst({
    where: { id: roId, orgId },
    include: {
      jobs: { select: { sortOrder: true } },
      laborLines: { select: { sortOrder: true } },
      partLines: { select: { sortOrder: true } },
    },
  });
  if (!ro) throw new Error("Repair order not found");

  const defaultRate = parseFloat(await getSetting(orgId, "defaultLaborRate")) || 0;
  const nextJobSort =
    ro.jobs.reduce((max, j) => Math.max(max, j.sortOrder), -1) + 1;
  const nextLaborSort =
    ro.laborLines.reduce((max, l) => Math.max(max, l.sortOrder), -1) + 1;
  const nextPartSort =
    ro.partLines.reduce((max, p) => Math.max(max, p.sortOrder), -1) + 1;

  await db.$transaction(async (tx) => {
    const roJob = await tx.job.create({
      data: {
        repairOrderId: roId,
        name: job.name,
        sortOrder: nextJobSort,
      },
    });
    for (let i = 0; i < job.laborItems.length; i++) {
      const l = job.laborItems[i];
      await tx.laborLine.create({
        data: {
          repairOrderId: roId,
          jobId: roJob.id,
          description: l.description,
          hours: l.hours,
          rate: l.rate ?? defaultRate,
          sortOrder: nextLaborSort + i,
        },
      });
    }
    for (let i = 0; i < job.partItems.length; i++) {
      const p = job.partItems[i];
      const catalogPart = p.part;
      const partLine = await tx.partLine.create({
        data: {
          repairOrderId: roId,
          jobId: roJob.id,
          partId: p.partId ?? null,
          partNumber: p.partNumber ?? catalogPart?.partNumber ?? null,
          description: p.description,
          quantity: p.quantity,
          unitPrice:
            p.unitPrice ?? catalogPart?.unitPrice ?? 0,
          costPrice: catalogPart?.costPrice ?? null,
          source: catalogPart?.source ?? null,
          sortOrder: nextPartSort + i,
        },
      });
      if (catalogPart && p.quantity > 0) {
        await tx.part.update({
          where: { id: catalogPart.id },
          data: { qtyOnHand: { decrement: p.quantity } },
        });
        await tx.stockMove.create({
          data: {
            partId: catalogPart.id,
            delta: -p.quantity,
            reason: "USE_RO",
            note: `Applied preset "${job.name}" to RO`,
            partLineId: partLine.id,
          },
        });
      }
    }
  });

  revalidatePath(`/repair-orders/${roId}`);
}

export async function applyCannedJobFormAction(roId: string, fd: FormData) {
  const jobId = String(fd.get("jobId") ?? "");
  if (!jobId) return;
  await applyCannedJobToRepairOrder(roId, jobId);
}
