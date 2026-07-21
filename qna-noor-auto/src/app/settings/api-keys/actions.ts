"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, requireOrgId } from "@/lib/session";
import {
  createApiKey,
  revokeApiKey,
} from "@/lib/apiKeys";

export type CreateApiKeyState = {
  token?: string;
  error?: string;
};

async function requireApiKeyManager(): Promise<string> {
  const orgId = await requireOrgId();
  const me = await getCurrentUser();
  if (
    !me ||
    me.orgId !== orgId ||
    (me.role !== "OWNER" && me.role !== "ADMIN")
  ) {
    redirect("/settings");
  }
  return orgId;
}

export async function createApiKeyAction(
  _previous: CreateApiKeyState | null,
  formData: FormData,
): Promise<CreateApiKeyState> {
  const orgId = await requireApiKeyManager();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give this key a name." };
  if (name.length > 100) return { error: "Key names must be 100 characters or fewer." };

  const token = await createApiKey(orgId, name);
  revalidatePath("/settings/api-keys");
  return { token };
}

export async function revokeApiKeyAction(id: string): Promise<void> {
  const orgId = await requireApiKeyManager();
  await revokeApiKey(orgId, id);
  revalidatePath("/settings/api-keys");
}
