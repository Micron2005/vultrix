"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parseMileage } from "@/lib/utils";

export async function markServiceDone(fd: FormData) {
  const vehicleId = String(fd.get("vehicleId") ?? "");
  const intervalId = String(fd.get("intervalId") ?? "");
  const atMileageRaw = fd.get("atMileage");
  const performedAtRaw = fd.get("performedAt");
  const note = fd.get("note");

  if (!vehicleId || !intervalId) return;

  const atMileage =
    typeof atMileageRaw === "string" ? parseMileage(atMileageRaw) : null;
  const performedAt =
    typeof performedAtRaw === "string" && performedAtRaw.trim() !== ""
      ? new Date(performedAtRaw)
      : new Date();

  await db.serviceLog.create({
    data: {
      vehicleId,
      intervalId,
      performedAt,
      atMileage: Number.isFinite(atMileage) ? atMileage : null,
      source: "manual",
      note: typeof note === "string" && note.trim() !== "" ? note.trim() : null,
    },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/");
}

export async function deleteServiceLog(fd: FormData) {
  const logId = String(fd.get("logId") ?? "");
  const vehicleId = String(fd.get("vehicleId") ?? "");
  if (!logId) return;
  await db.serviceLog.delete({ where: { id: logId } });
  if (vehicleId) revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/");
}
