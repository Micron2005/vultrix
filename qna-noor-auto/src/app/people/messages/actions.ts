"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  conversationPair,
  isUnreadFor,
  MESSAGE_MAX,
  normalizeMessageBody,
  previewOf,
} from "@/lib/messages";
import { normalizeHandle } from "@/lib/people";
import { requirePeopleManager } from "@/lib/peopleAccess";
import { notify } from "@/lib/notifications";

function redirectMessageError(
  handle: string,
  formData: FormData,
  error: string,
): never {
  const normalizedHandle = normalizeHandle(handle);
  if (!normalizedHandle) redirect("/people");
  const value = formData.get("body");
  const body = typeof value === "string" ? value.slice(0, MESSAGE_MAX) : "";
  const params = new URLSearchParams({ error, body });
  redirect(`/people/messages/${normalizedHandle}?${params}`);
}

export async function sendMessage(handle: string, formData: FormData) {
  const orgId = await requirePeopleManager();
  const viewer = await db.profile.findUnique({
    where: { orgId },
    select: { id: true, handle: true, displayName: true },
  });
  if (!viewer) redirect("/people?need_profile=1");

  const targetHandle = normalizeHandle(handle);
  const target = targetHandle
    ? await db.profile.findUnique({
        where: { handle: targetHandle },
        select: { id: true, orgId: true, handle: true },
      })
    : null;
  if (!target || target.id === viewer.id) {
    redirectMessageError(handle, formData, "not_connected");
  }

  const rawBody = formData.get("body");
  const raw = typeof rawBody === "string" ? rawBody : "";
  const body = normalizeMessageBody(raw);
  if (!body) {
    redirectMessageError(
      handle,
      formData,
      raw.trim() ? "too_long" : "empty",
    );
  }

  const pair = conversationPair(viewer.id, target.id);
  const preview = previewOf(body);
  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    const [followsTarget, targetFollowsViewer] = await Promise.all([
      tx.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewer.id,
            followingId: target.id,
          },
        },
        select: { id: true },
      }),
      tx.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: target.id,
            followingId: viewer.id,
          },
        },
        select: { id: true },
      }),
    ]);
    if (!followsTarget || !targetFollowsViewer) {
      return { error: "not_connected" as const };
    }

    const recentMessageCount = await tx.directMessage.count({
      where: {
        senderProfileId: viewer.id,
        createdAt: { gte: new Date(now.getTime() - 60_000) },
      },
    });
    if (recentMessageCount >= 20) {
      return { error: "slow_down" as const };
    }

    const conversation = await tx.conversation.upsert({
      where: {
        aProfileId_bProfileId: pair,
      },
      create: pair,
      update: {},
      select: {
        id: true,
        aProfileId: true,
        aReadAt: true,
        bReadAt: true,
        lastMessageAt: true,
        lastSenderProfileId: true,
      },
    });
    const recipientWasUnread = isUnreadFor(target.id, conversation);

    await tx.directMessage.create({
      data: {
        conversationId: conversation.id,
        senderProfileId: viewer.id,
        body,
        createdAt: now,
      },
    });
    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: now,
        lastSenderProfileId: viewer.id,
        lastPreview: preview,
        ...(viewer.id === conversation.aProfileId
          ? { aReadAt: now }
          : { bReadAt: now }),
      },
    });

    return {
      notifyRecipient: !recipientWasUnread,
    };
  });

  if ("error" in result && result.error) {
    redirectMessageError(handle, formData, result.error);
  }

  if (result.notifyRecipient) {
    await notify({
      orgId: target.orgId,
      kind: "message",
      title: `New message from ${viewer.displayName}`,
      body: preview,
      href: `/people/messages/${viewer.handle}`,
    });
  }

  revalidatePath("/people/messages");
  revalidatePath(`/people/messages/${viewer.handle}`);
  revalidatePath(`/people/messages/${target.handle}`);
  redirect(`/people/messages/${target.handle}`);
}
