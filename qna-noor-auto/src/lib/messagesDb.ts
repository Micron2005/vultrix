import { db } from "@/lib/db";
import { isUnreadFor } from "@/lib/messages";
import { requirePeopleManager } from "@/lib/peopleAccess";

export async function unreadConversationCount(orgId: string): Promise<number> {
  const managerOrgId = await requirePeopleManager();
  if (managerOrgId !== orgId) return 0;

  const profile = await db.profile.findUnique({
    where: { orgId },
    select: { id: true },
  });
  if (!profile) return 0;

  const conversations = await db.conversation.findMany({
    where: {
      lastMessageAt: { not: null },
      OR: [{ aProfileId: profile.id }, { bProfileId: profile.id }],
    },
    select: {
      aProfileId: true,
      aReadAt: true,
      bReadAt: true,
      lastMessageAt: true,
      lastSenderProfileId: true,
    },
  });
  return conversations.filter((conversation) =>
    isUnreadFor(profile.id, conversation),
  ).length;
}
