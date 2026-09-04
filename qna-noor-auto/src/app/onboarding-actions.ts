"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";

function requireOnboardingManager(role: string) {
  if (role !== "OWNER" && role !== "ADMIN") {
    throw new Error("You don't have permission to manage onboarding.");
  }
}

export async function dismissOnboarding() {
  const user = await requireUser();
  requireOnboardingManager(user.role);
  const orgId = await requireOrgId();
  await db.organization.update({
    where: { id: orgId },
    data: { onboardingDismissedAt: new Date() },
  });
  revalidatePath("/");
}

export async function resetOnboarding() {
  const user = await requireUser();
  requireOnboardingManager(user.role);
  const orgId = await requireOrgId();
  await db.organization.update({
    where: { id: orgId },
    data: { onboardingDismissedAt: null },
  });
  revalidatePath("/");
  revalidatePath("/settings");
}
