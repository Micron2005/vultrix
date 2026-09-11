"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertCanManageSettings } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export async function saveVehicleIntelSharing(formData: FormData) {
  const user = await requireUser();
  assertCanManageSettings(user.role);
  if (user.role !== "OWNER" || !user.orgId) {
    redirect("/settings#vehicle-intel");
  }

  const org = await db.organization.findUnique({
    where: { id: user.orgId },
    select: { accountType: true },
  });
  if (!org || org.accountType !== "AUTO_SHOP") {
    redirect("/settings");
  }

  await db.organization.update({
    where: { id: user.orgId },
    data: { shareFixes: formData.has("shareFixes") },
  });
  revalidatePath("/settings");
  revalidatePath("/intel");
  redirect("/settings#vehicle-intel");
}
