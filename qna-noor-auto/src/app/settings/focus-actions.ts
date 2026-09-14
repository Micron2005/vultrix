"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertCanManageSettings } from "@/lib/permissions";
import { normalizeFocusPacks } from "@/lib/focusPacks";
import { requireUser } from "@/lib/session";

export async function saveFocusPacks(formData: FormData) {
  const user = await requireUser();
  assertCanManageSettings(user.role);
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    redirect("/settings");
  }
  if (user.accountType !== "PERSONAL" || !user.orgId) {
    redirect("/settings");
  }
  const packs = normalizeFocusPacks(formData.getAll("packs"));
  await db.organization.update({
    where: { id: user.orgId },
    data: { focusPacks: packs },
  });
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/goals");
  revalidatePath("/notes");
  redirect("/settings");
}
