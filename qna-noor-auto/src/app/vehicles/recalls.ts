"use server";

import { revalidatePath } from "next/cache";
import { requireOrgId } from "@/lib/session";
import { refreshVehicleRecalls } from "@/lib/nhtsa";

export async function refreshRecallsAction(vehicleId: string) {
  const orgId = await requireOrgId();
  await refreshVehicleRecalls(orgId, vehicleId);
  revalidatePath(`/vehicles/${vehicleId}`);
}
