"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { forgetMemory, rememberMemory } from "@/lib/assistant/memory";
import { requireUser } from "@/lib/session";

async function requireAssistantUser() {
  const user = await requireUser();
  if (!user.orgId) redirect("/");
  const org = await db.organization.findUnique({
    where: { id: user.orgId },
    select: { aiAssistantEnabled: true },
  });
  if (!org?.aiAssistantEnabled) redirect("/");
  return { ...user, orgId: user.orgId };
}

export async function createMemory(formData: FormData) {
  const user = await requireAssistantUser();
  await rememberMemory(user.orgId, user.id, {
    content: String(formData.get("content") ?? ""),
    category: String(formData.get("category") ?? "fact"),
    source: "USER",
  });
  revalidatePath("/assistant/memory");
  redirect("/assistant/memory");
}

export async function updateMemory(id: string, formData: FormData) {
  const user = await requireAssistantUser();
  const content = String(formData.get("content") ?? "").trim();
  const current = await db.assistantMemory.findFirst({
    where: { id, orgId: user.orgId, userId: user.id },
    select: { category: true, source: true },
  });
  if (!current) redirect("/assistant/memory");
  await db.assistantMemory.delete({ where: { id } });
  await rememberMemory(user.orgId, user.id, {
    content,
    category: current.category,
    source: current.source === "USER" ? "USER" : "ASSISTANT",
  });
  revalidatePath("/assistant/memory");
  redirect("/assistant/memory");
}

export async function deleteMemory(id: string) {
  const user = await requireAssistantUser();
  await forgetMemory(user.orgId, user.id, { id });
  revalidatePath("/assistant/memory");
  redirect("/assistant/memory");
}

export async function forgetEverything() {
  const user = await requireAssistantUser();
  await db.assistantMemory.deleteMany({
    where: { orgId: user.orgId, userId: user.id },
  });
  revalidatePath("/assistant/memory");
  redirect("/assistant/memory");
}
