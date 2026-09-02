"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { normalizeAppearance } from "@/lib/appearance";

export async function saveAppearance(fd: FormData) {
  const user = await requireUser();
  const prefs = normalizeAppearance({
    palette: fd.get("palette"),
    accent: fd.get("accent"),
    scale: fd.get("scale"),
    radius: fd.get("radius"),
    font: fd.get("font"),
  });
  await db.user.update({
    where: { id: user.id },
    data: {
      uiPalette: prefs.palette,
      uiAccent: prefs.accent,
      uiScale: prefs.scale,
      uiRadius: prefs.radius,
      uiFont: prefs.font,
    },
  });
  revalidatePath("/", "layout");
}

export async function resetAppearance() {
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: {
      uiPalette: null,
      uiAccent: null,
      uiScale: null,
      uiRadius: null,
      uiFont: null,
    },
  });
  revalidatePath("/", "layout");
}
