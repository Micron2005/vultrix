"use server";

import { redirect } from "next/navigation";
import { verifyUnsubscribeToken } from "@/lib/announcements";
import { db } from "@/lib/db";

export async function confirmAnnouncementUnsubscribe(
  formData: FormData,
): Promise<void> {
  const orgId = String(formData.get("o") ?? "");
  const token = String(formData.get("t") ?? "");
  if (!orgId || !verifyUnsubscribeToken(orgId, token)) {
    redirect("/unsubscribe?error=invalid");
  }
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });
  if (!org) redirect("/unsubscribe?error=invalid");
  await db.organization.update({
    where: { id: orgId },
    data: { announcementsOptOut: true },
  });
  redirect(
    `/unsubscribe?o=${encodeURIComponent(orgId)}&t=${encodeURIComponent(token)}&done=1`,
  );
}
