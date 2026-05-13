"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { parseTheme } from "./theme";
import type { LandingTheme } from "./theme";

async function requireAuth() {
  if (!(await isAuthenticated())) {
    throw new Error("Unauthorized");
  }
}

const SINGLETON_ID = "singleton";

export async function getLandingContent(): Promise<{
  html: string;
  theme: LandingTheme;
}> {
  const row = await db.landingContent.findUnique({
    where: { id: SINGLETON_ID },
  });
  return {
    html: row?.html ?? "",
    theme: parseTheme(row?.theme ?? "{}"),
  };
}

export async function saveLandingContent(html: string) {
  await requireAuth();
  await db.landingContent.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, html },
    update: { html },
  });
  revalidatePath("/site");
}

export async function saveLandingTheme(theme: LandingTheme) {
  await requireAuth();
  await db.landingContent.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, theme: JSON.stringify(theme) },
    update: { theme: JSON.stringify(theme) },
  });
  revalidatePath("/site");
}
