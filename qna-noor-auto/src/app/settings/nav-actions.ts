"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { enabledFeatureSet } from "@/lib/features";
import {
  normalizeNavLayout,
  serializeNavLayout,
} from "@/lib/navLayout";

export async function saveNavLayout(fd: FormData) {
  const user = await requireUser();
  const features = enabledFeatureSet(user);
  const layout = normalizeNavLayout(fd.get("layout"), {
    accountType: user.accountType,
    enabledFeatures: features,
  });
  await db.user.update({
    where: { id: user.id },
    data: { navLayout: serializeNavLayout(layout) },
  });
  revalidatePath("/", "layout");
}

export async function resetNavLayout() {
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: { navLayout: null },
  });
  revalidatePath("/", "layout");
}
