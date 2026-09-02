"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  normalizeDashboardLayout,
  serializeDashboardLayout,
} from "@/lib/dashboard";

export async function saveDashboardLayout(fd: FormData) {
  const user = await requireUser();
  const layout = normalizeDashboardLayout(fd.get("layout"));
  await db.user.update({
    where: { id: user.id },
    data: { dashLayout: serializeDashboardLayout(layout) },
  });
  revalidatePath("/");
}

export async function resetDashboardLayout() {
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: { dashLayout: null },
  });
  revalidatePath("/");
}
