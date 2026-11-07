import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button, Card, CardBody, LinkButton, Textarea } from "@/components/ui";
import { db } from "@/lib/db";
import {
  conversationPair,
  MESSAGE_MAX,
} from "@/lib/messages";
import { normalizeHandle, relationship } from "@/lib/people";
import { requirePeopleManager } from "@/lib/peopleAccess";
import { orgTimeZone } from "@/lib/orgTimezone";
import { formatInTimeZone } from "@/lib/timezone";
import { sendMessage } from "../actions";
import { ThreadRefresh } from "./ThreadRefresh";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const messageErrors: Record<string, string> = {
  empty: "Write a message before sending.",
  not_connected:
    "You're no longer connected, so you can't send messages. Follow each other again to keep talking.",
  slow_down: "Please wait a moment before sending another message.",
  too_long: `Messages must be ${MESSAGE_MAX} characters or fewer.`,
};

export default async function MessageThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const orgId = await requirePeopleManager();
  const [{ handle: rawHandle }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const handle = normalizeHandle(rawHandle);
  if (!handle) notFound();

  const viewer = await db.profile.findUnique({
    where: { orgId },
    select: { id: true, handle: true },
  });
  if (!viewer) redirect("/people?need_profile=1");

  const target = await db.profile.findUnique({
    where: { handle },
    select: { id: true, handle: true, displayName: true },
  });
  if (!target || target.id === viewer.id) notFound();

  const pair = conversationPair(viewer.id, target.id);
  const [conversation, relation, timezone] = await Promise.all([
    db.conversation.findUnique({
      where: { aProfileId_bProfileId: pair },
      select: { id: true },
    }),
    relationship(viewer.id, target.id),
    orgTimeZone(orgId),
  ]);
  if (!conversation && !relation.connected) notFound();

  const messages = conversation
    ? (
        await db.directMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 200,
          select: {
            id: true,
            senderProfileId: true,
            body: true,
            createdAt: true,
          },
        })
      ).reverse()
    : [];
  if (conversation) {
    await db.conversation.updateMany({
      where: { id: conversation.id },
      data:
        viewer.id === pair.aProfileId
          ? { aReadAt: new Date() }
          : { bReadAt: new Date() },
    });
  }

  const groups: Array<{
    senderProfileId: string;
    messages: typeof messages;
  }> = [];
  for (const message of messages) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.senderProfileId === message.senderProfileId) {
      lastGroup.messages.push(message);
    } else {
      groups.push({
        senderProfileId: message.senderProfileId,
        messages: [message],
      });
    }
  }

  const body = firstValue(query.body).slice(0, MESSAGE_MAX);
  const error = messageErrors[firstValue(query.error)];
  const isConnected = relation.connected;

  return (
    <div className="min-w-0 space-y-6">
      <header className="mb-8 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-[22px] font-semibold tracking-tight text-zinc-900 sm:text-2xl">
            <Link
              href={`/people/${target.handle}`}
              className="hover:text-[var(--vx-accent-700)]"
            >
              {target.displayName}
            </Link>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">@{target.handle}</p>
        </div>
        <LinkButton href="/people/messages" variant="secondary">
          Inbox
        </LinkButton>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"
        >
          {error}
        </p>
      )}

      <Card>
        <CardBody className="min-w-0 space-y-5">
          <div className="min-w-0 space-y-4">
            {groups.map((group, index) => {
              const own = group.senderProfileId === viewer.id;
              const lastMessage = group.messages[group.messages.length - 1];
              return (
                <div
                  key={`${group.senderProfileId}:${index}`}
                  className={`flex min-w-0 ${
                    own ? "justify-end" : "justify-start"
                  }`}
                >
                  <div className="min-w-0 max-w-[88%] space-y-1 sm:max-w-[75%]">
                    {group.messages.map((message) => (
                      <p
                        key={message.id}
                        className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                          own
                            ? "bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)]"
                            : "bg-zinc-100 text-zinc-900"
                        }`}
                      >
                        {message.body}
                      </p>
                    ))}
                    {lastMessage && (
                      <p
                        className={`px-1 text-[11px] text-zinc-500 ${
                          own ? "text-right" : "text-left"
                        }`}
                      >
                        {formatInTimeZone(lastMessage.createdAt, timezone, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {!messages.length && isConnected && (
              <p className="text-sm text-zinc-500">
                No messages yet. Say hello.
              </p>
            )}
          </div>

          {isConnected ? (
            <form
              action={sendMessage.bind(null, target.handle)}
              className="space-y-3 border-t border-zinc-200 pt-4"
            >
              <label
                htmlFor="message-body"
                className="block text-sm font-medium text-zinc-800"
              >
                Message
              </label>
              <Textarea
                id="message-body"
                name="body"
                rows={4}
                maxLength={MESSAGE_MAX}
                defaultValue={body}
                placeholder="Write a message…"
                className="w-full min-w-0"
              />
              <Button type="submit">Send</Button>
            </form>
          ) : (
            <p
              role="status"
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"
            >
              You&apos;re no longer connected, so you can&apos;t send messages.
              Follow each other again to keep talking.
            </p>
          )}

          <ThreadRefresh messageCount={messages.length} />
          <div id="message-thread-bottom" />
        </CardBody>
      </Card>
    </div>
  );
}
