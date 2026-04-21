"use server";

import { revalidatePath } from "next/cache";
import { refreshVehicleRecalls } from "@/lib/nhtsa";

export async function refreshRecallsAction(vehicleId: string) {
  await refreshVehicleRecalls(vehicleId);
  revalidatePath(`/vehicles/${vehicleId}`);
}
