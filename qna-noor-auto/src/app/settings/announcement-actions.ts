"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, requireOrgId } from "@/lib/session";

export async function updateAnnouncementEmailPreference(
  formData: FormData,
): Promise<void> {
  const user = await getCurrentUser();
  const orgId = await requireOrgId();
  if (!user || user.orgId !== orgId || user.role !== "OWNER") {
    throw new Error("Only the account owner can change announcement preferences.");
  }
  const optedIn = formData.getAll("optIn").some((value) => value === "true");
  await db.organization.update({
    where: { id: orgId },
    data: { announcementsOptOut: !optedIn },
  });
  revalidatePath("/settings");
  redirect("/settings");
}
