import { db } from "@/lib/db";

export const MEMORY_CATEGORIES = [
  "preference",
  "fact",
  "project",
  "other",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];
export type MemorySource = "ASSISTANT" | "USER";

const MAX_MEMORIES = 150;
const SECRET_PATTERN =
  /password|passcode|pin\b|api key|token|card number|ssn|\d{13,19}/i;

export function validateMemoryContent(raw: string): string {
  const content = raw.trim();
  if (!content || content.length > 400) {
    throw new Error("Memory must be between 1 and 400 characters.");
  }
  if (SECRET_PATTERN.test(content)) {
    throw new Error("I don't store passwords, keys or card numbers.");
  }
  return content;
}

export async function listMemories(orgId: string, userId: string) {
  return db.assistantMemory.findMany({
    where: { orgId, userId },
    orderBy: { updatedAt: "asc" },
  });
}

export async function rememberMemory(
  orgId: string,
  userId: string,
  input: {
    content: string;
    category?: string;
    source?: MemorySource;
  },
): Promise<{ id: string; deduped: boolean }> {
  const content = validateMemoryContent(input.content);
  const category = MEMORY_CATEGORIES.includes(
    input.category as MemoryCategory,
  )
    ? (input.category as MemoryCategory)
    : "fact";
  const existing = await db.assistantMemory.findMany({
    where: { orgId, userId },
    select: { id: true, content: true },
  });
  const duplicate = existing.find(
    (memory) => memory.content.toLowerCase() === content.toLowerCase(),
  );
  if (duplicate) return { id: duplicate.id, deduped: true };
  if (existing.length >= MAX_MEMORIES) {
    const oldestAssistant = await db.assistantMemory.findFirst({
      where: { orgId, userId, source: "ASSISTANT" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!oldestAssistant) throw new Error("Memory limit reached.");
    await db.assistantMemory.delete({ where: { id: oldestAssistant.id } });
  }
  const memory = await db.assistantMemory.create({
    data: {
      orgId,
      userId,
      content,
      category,
      source: input.source ?? "USER",
    },
    select: { id: true },
  });
  return { id: memory.id, deduped: false };
}

export async function forgetMemory(
  orgId: string,
  userId: string,
  input: { id?: string; query?: string },
): Promise<{ count: number }> {
  if (input.id?.trim()) {
    const result = await db.assistantMemory.deleteMany({
      where: { id: input.id.trim(), orgId, userId },
    });
    return { count: result.count };
  }
  const query = input.query?.trim();
  if (!query) return { count: 0 };
  const memories = await db.assistantMemory.findMany({
    where: { orgId, userId },
    select: { id: true, content: true },
  });
  const ids = memories
    .filter((memory) =>
      memory.content.toLowerCase().includes(query.toLowerCase()),
    )
    .map((memory) => memory.id);
  if (ids.length === 0) return { count: 0 };
  const result = await db.assistantMemory.deleteMany({
    where: { id: { in: ids }, orgId, userId },
  });
  return { count: result.count };
}

export function formatMemoriesForPrompt(
  memories: Array<{ category: string; content: string }>,
): string {
  return memories
    .map((memory) => `- [${memory.category}] ${memory.content}`)
    .join("\n");
}
