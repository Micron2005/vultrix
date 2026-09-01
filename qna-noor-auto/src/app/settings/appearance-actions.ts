"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { DEFAULT_APPEARANCE, normalizeAppearance } from "@/lib/appearance";

export async function saveAppearance(fd: FormData) {
  const user = await requireUser();
  if (user.accountType !== "PERSONAL") {
    throw new Error("Appearance customization is only available for personal accounts");
  }

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
  if (user.accountType !== "PERSONAL") {
    throw new Error("Appearance customization is only available for personal accounts");
  }
  await db.user.update({
    where: { id: user.id },
    data: {
      uiPalette: DEFAULT_APPEARANCE.palette,
      uiAccent: DEFAULT_APPEARANCE.accent,
      uiScale: DEFAULT_APPEARANCE.scale,
      uiRadius: DEFAULT_APPEARANCE.radius,
      uiFont: DEFAULT_APPEARANCE.font,
    },
  });
  revalidatePath("/", "layout");
}
