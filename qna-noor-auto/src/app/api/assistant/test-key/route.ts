import { z } from "zod";
import { db } from "@/lib/db";
import { decryptAiApiKey, isAiKeyEncryptionConfigured } from "@/lib/ai-key-crypto";
import { friendlyError } from "@/lib/assistant/errors";
import {
  runAssistantProvider,
  type AssistantProvider,
} from "@/lib/assistant/providers";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const OPENAI_MODEL =
  process.env.ASSISTANT_OPENAI_MODEL?.trim() || "gpt-4o";
const ANTHROPIC_MODEL =
  process.env.ASSISTANT_ANTHROPIC_MODEL?.trim() ||
  "claude-3-5-sonnet-latest";

const requestSchema = z.object({
  provider: z.enum(["OPENAI", "ANTHROPIC"]),
  apiKey: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (
    user.role !== "OWNER" &&
    user.role !== "ADMIN"
  ) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!user.orgId) {
    return Response.json({ error: "Organization required" }, { status: 403 });
  }

  const org = await db.organization.findUnique({
    where: { id: user.orgId },
    select: {
      accountType: true,
      aiAssistantApiKeyEncrypted: true,
    },
  });
  if (!org || org.accountType !== "PERSONAL") {
    return Response.json({ error: "Assistant is not enabled" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Provider is required" }, { status: 400 });
  }

  const provider: AssistantProvider = parsed.data.provider;
  const suppliedKey = parsed.data.apiKey?.trim();
  let apiKey = suppliedKey;
  if (!apiKey) {
    if (!org.aiAssistantApiKeyEncrypted) {
      return Response.json({
        ok: false,
        message: "No key saved yet — paste one above first.",
      });
    }
    if (!isAiKeyEncryptionConfigured()) {
      return Response.json({
        ok: false,
        message: "The saved key is unavailable right now — check AI_KEY_SECRET.",
      });
    }
    try {
      apiKey = decryptAiApiKey(org.aiAssistantApiKeyEncrypted);
    } catch (error) {
      console.error("[assistant] saved key test failed", error);
      return Response.json({
        ok: false,
        message: "The saved key is unavailable right now — check AI_KEY_SECRET.",
      });
    }
  }

  const model = provider === "OPENAI" ? OPENAI_MODEL : ANTHROPIC_MODEL;
  try {
    await runAssistantProvider({
      provider,
      apiKey,
      model,
      systemPrompt: "Reply with the single word OK.",
      messages: [{ role: "user", content: "ping" }],
      tools: [],
    });
    const label = provider === "OPENAI" ? "OpenAI" : "Anthropic";
    return Response.json({
      ok: true,
      message: `${label} key works (${model}).`,
    });
  } catch (error) {
    console.error("[assistant] key test failed", error);
    return Response.json({ ok: false, message: friendlyError(error) });
  }
}
