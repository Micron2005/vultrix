"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/session";
import {
  normalizeLandingConfig,
  type LandingConfig,
} from "@/lib/landingConfig";
import { saveLandingConfig } from "@/lib/landing";

export async function saveLanding(json: string): Promise<{ ok: boolean; error?: string }> {
  await requireSuperadmin();
  if (Buffer.byteLength(json, "utf8") > 200 * 1024) {
    return { ok: false, error: "Landing configuration is too large." };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "Landing configuration is not valid JSON." };
  }
  try {
    await saveLandingConfig(normalizeLandingConfig(raw) as LandingConfig);
    revalidatePath("/");
    revalidatePath("/admin/landing");
    revalidatePath("/admin/landing/preview");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save landing configuration." };
  }
}
