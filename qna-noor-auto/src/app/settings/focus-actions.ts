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
  if (!user.orgId) redirect("/settings");
  const submittedPacks = normalizeFocusPacks(formData.getAll("packs"));
  let packs = submittedPacks;
  if (user.accountType !== "PERSONAL") {
    const organization = await db.organization.findUnique({
      where: { id: user.orgId },
      select: { focusPacks: true },
    });
    if (!organization) redirect("/settings");
    const existingPersonalPacks = normalizeFocusPacks(
      organization.focusPacks,
    ).filter((pack) => pack !== "music");
    packs = normalizeFocusPacks([
      ...existingPersonalPacks,
      ...(submittedPacks.includes("music") ? ["music"] : []),
    ]);
  }
  await db.organization.update({
    where: { id: user.orgId },
    data: { focusPacks: packs },
  });
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/songs");
  revalidatePath("/goals");
  revalidatePath("/notes");
  redirect("/settings");
}
