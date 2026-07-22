"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  encryptAiApiKey,
  isAiKeyEncryptionConfigured,
} from "@/lib/ai-key-crypto";
import { requireUser } from "@/lib/session";

const AssistantSettingsSchema = z.object({
  enabled: z.enum(["on"]).optional(),
  provider: z.enum(["OLLAMA", "OPENAI", "ANTHROPIC"]),
  assistantName: z.string().trim().min(1).max(80),
  voice: z.string().trim().max(300).optional(),
  apiKey: z.string().trim().optional(),
  clearApiKey: z.enum(["on"]).optional(),
});

export async function saveAiAssistantSettings(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    redirect("/settings?assistant_error=not_allowed");
  }
  if (!user.orgId) redirect("/settings?assistant_error=no_org");

  const org = await db.organization.findUnique({
    where: { id: user.orgId },
    select: {
      accountType: true,
      aiHostedEnabled: true,
      aiAssistantApiKeyEncrypted: true,
    },
  });
  if (!org) redirect("/settings?assistant_error=no_org");
  if (org.accountType !== "PERSONAL") {
    redirect("/settings?assistant_error=personal_only");
  }

  const parsed = AssistantSettingsSchema.safeParse({
    enabled: formData.get("enabled") === "on" ? "on" : undefined,
    provider: formData.get("provider"),
    assistantName: formData.get("assistantName"),
    voice: formData.get("voice") ?? undefined,
    apiKey: formData.get("apiKey") ?? undefined,
    clearApiKey:
      formData.get("clearApiKey") === "on" ? "on" : undefined,
  });
  if (!parsed.success) redirect("/settings?assistant_error=invalid");

  const input = parsed.data;
  if (input.provider === "OLLAMA" && !org.aiHostedEnabled) {
    redirect(
      "/settings?assistant_error=hosted_ai_required",
    );
  }
  const suppliedApiKey = input.apiKey ?? "";
  const wantsOwnKey = input.provider === "OPENAI" || input.provider === "ANTHROPIC";
  if (wantsOwnKey && !isAiKeyEncryptionConfigured() && suppliedApiKey) {
    redirect("/settings?assistant_error=key_unavailable");
  }
  if (wantsOwnKey && !suppliedApiKey && !org.aiAssistantApiKeyEncrypted) {
    redirect("/settings?assistant_error=key_required");
  }

  let encryptedKey = org.aiAssistantApiKeyEncrypted;
  if (input.clearApiKey || input.provider === "OLLAMA") {
    encryptedKey = null;
  } else if (suppliedApiKey) {
    if (!isAiKeyEncryptionConfigured()) {
      redirect("/settings?assistant_error=key_unavailable");
    }
    encryptedKey = encryptAiApiKey(suppliedApiKey);
  }

  await db.organization.update({
    where: { id: user.orgId },
    data: {
      aiAssistantEnabled: input.enabled === "on",
      aiAssistantProvider: input.provider,
      aiAssistantApiKeyEncrypted: encryptedKey,
      aiAssistantName: input.assistantName,
      aiAssistantVoice: input.voice || null,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/");
  redirect("/settings?assistant_saved=1");
}
