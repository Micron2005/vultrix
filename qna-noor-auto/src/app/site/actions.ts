"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

async function requireAuth() {
  if (!(await isAuthenticated())) {
    throw new Error("Unauthorized");
  }
}

const SINGLETON_ID = "singleton";

export async function getLandingContent(): Promise<string> {
  const row = await db.landingContent.findUnique({
    where: { id: SINGLETON_ID },
  });
  return row?.html ?? "";
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
