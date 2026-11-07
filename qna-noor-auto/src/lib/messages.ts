export const MESSAGE_MAX = 2000;

export function conversationPair(
  x: string,
  y: string,
): { aProfileId: string; bProfileId: string } {
  if (x === y) {
    throw new Error("A conversation requires two different profiles");
  }
  return x < y
    ? { aProfileId: x, bProfileId: y }
    : { aProfileId: y, bProfileId: x };
}

export function normalizeMessageBody(raw: string): string | null {
  const body = raw
    .replace(/\r\n?/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  return body && body.length <= MESSAGE_MAX ? body : null;
}

export function isUnreadFor(
  viewerProfileId: string,
  conversation: {
    aProfileId: string;
    aReadAt: Date | null;
    bReadAt: Date | null;
    lastMessageAt: Date | null;
    lastSenderProfileId: string | null;
  },
): boolean {
  if (
    !conversation.lastMessageAt ||
    conversation.lastSenderProfileId === viewerProfileId
  ) {
    return false;
  }
  const readAt =
    viewerProfileId === conversation.aProfileId
      ? conversation.aReadAt
      : conversation.bReadAt;
  return !readAt || readAt.getTime() < conversation.lastMessageAt.getTime();
}

export function previewOf(body: string): string {
  const line = body.replace(/\s+/g, " ").trim();
  const characters = Array.from(line);
  if (characters.length <= 140) return line;
  return `${characters.slice(0, 139).join("").trimEnd()}…`;
}
