"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/session";
import {
  DEFAULT_APPEARANCE,
  normalizeAppearance,
} from "@/lib/appearance";
import {
  APPEARANCE_COOKIE,
  serializeAppearance,
} from "@/lib/appearanceCookie";

const appearanceCookieOptions = {
  httpOnly: false,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export async function saveAppearance(fd: FormData) {
  await requireUser();
  const prefs = normalizeAppearance({
    palette: fd.get("palette"),
    accent: fd.get("accent"),
    scale: fd.get("scale"),
    radius: fd.get("radius"),
    font: fd.get("font"),
  });
  (await cookies()).set(
    APPEARANCE_COOKIE,
    serializeAppearance(prefs),
    appearanceCookieOptions,
  );
  revalidatePath("/", "layout");
}

export async function resetAppearance() {
  await requireUser();
  (await cookies()).set(
    APPEARANCE_COOKIE,
    serializeAppearance(DEFAULT_APPEARANCE),
    appearanceCookieOptions,
  );
  revalidatePath("/", "layout");
}
