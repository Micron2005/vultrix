import { z } from "zod";

export function friendlyError(error: unknown): string {
  if (error instanceof z.ZodError) {
    const first = error.issues[0];
    const field = first?.path?.join(".") ?? "";
    return field
      ? `I still need the "${field}" for that. Could you tell me?`
      : "I still need a bit more information for that. Could you clarify?";
  }
  const message = error instanceof Error ? error.message : "";
  if (
    message.includes("ECONNREFUSED") ||
    message.includes("fetch failed") ||
    message.includes("Provider returned")
  ) {
    return "I couldn't reach the assistant service right now. Please try again shortly.";
  }
  const rejectedKey = message.match(/\b(OpenAI|Anthropic) error \(HTTP (401|403)\b/);
  if (rejectedKey) {
    return `Your ${rejectedKey[1]} key was rejected — check it in Settings → AI assistant.`;
  }
  if (message.includes("error (HTTP 429")) {
    return "The assistant provider is rate-limiting or out of credits right now. Please try again shortly.";
  }
  if (message.includes("error (HTTP")) return message;
  return message || "I couldn't complete that request.";
}
