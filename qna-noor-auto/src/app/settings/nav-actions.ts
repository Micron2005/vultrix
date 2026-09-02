"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  normalizeNavLayout,
  serializeNavLayout,
} from "@/lib/navLayout";

export async function saveNavLayout(fd: FormData) {
  const user = await requireUser();
  if (user.accountType !== "PERSONAL") {
    throw new Error("Sidebar customization is only available for personal accounts");
  }
  const layout = normalizeNavLayout(fd.get("layout"));
  await db.user.update({
    where: { id: user.id },
    data: { navLayout: serializeNavLayout(layout) },
  });
  revalidatePath("/", "layout");
}

export async function resetNavLayout() {
  const user = await requireUser();
  if (user.accountType !== "PERSONAL") {
    throw new Error("Sidebar customization is only available for personal accounts");
  }
  await db.user.update({
    where: { id: user.id },
    data: { navLayout: null },
  });
  revalidatePath("/", "layout");
}
