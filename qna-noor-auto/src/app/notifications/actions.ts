"use server";

import { revalidatePath } from "next/cache";
import { markRead } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await markRead(user, "all");
  revalidatePath("/notifications");
}
