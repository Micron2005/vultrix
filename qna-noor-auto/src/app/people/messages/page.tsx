import Link from "next/link";
import { redirect } from "next/navigation";
import { LinkButton, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { isUnreadFor } from "@/lib/messages";
import { requirePeopleManager } from "@/lib/peopleAccess";
import { orgTimeZone } from "@/lib/orgTimezone";
import { formatInTimeZone, localCalendarDay, shiftCalendarDay } from "@/lib/timezone";

function shortTime(date: Date, timezone: string, todayKey: string): string {
  const dateKey = localCalendarDay(date, timezone);
  const time = formatInTimeZone(date, timezone, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (dateKey === todayKey) return time;
  if (dateKey === shiftCalendarDay(todayKey, -1)) {
    return `Yesterday, ${time}`;
  }
  return formatInTimeZone(date, timezone, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function MessagesPage() {
  const orgId = await requirePeopleManager();
  const profile = await db.profile.findUnique({
    where: { orgId },
    select: { id: true },
  });
  if (!profile) redirect("/people?need_profile=1");

  const [timezone, conversations] = await Promise.all([
    orgTimeZone(orgId),
    db.conversation.findMany({
      where: {
        lastMessageAt: { not: null },
        messages: { some: {} },
        OR: [{ aProfileId: profile.id }, { bProfileId: profile.id }],
      },
      orderBy: { lastMessageAt: "desc" },
      select: {
        aProfileId: true,
        bProfileId: true,
        aReadAt: true,
        bReadAt: true,
        lastMessageAt: true,
        lastSenderProfileId: true,
        lastPreview: true,
        aProfile: {
          select: { handle: true, displayName: true },
        },
        bProfile: {
          select: { handle: true, displayName: true },
        },
      },
    }),
  ]);
  const todayKey = localCalendarDay(new Date(), timezone);
  const rows = conversations.flatMap((conversation) => {
    if (!conversation.lastMessageAt) return [];
    const other =
      conversation.aProfileId === profile.id
        ? conversation.bProfile
        : conversation.aProfile;
    return [
      {
        conversation,
        other,
        unread: isUnreadFor(profile.id, conversation),
        time: shortTime(conversation.lastMessageAt, timezone, todayKey),
      },
    ];
  });

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Messages"
        description="Private messages with people you're connected to."
        actions={
          <LinkButton href="/people" variant="secondary">
            People
          </LinkButton>
        }
      />
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {rows.length ? (
          <div className="divide-y divide-zinc-200">
            {rows.map(({ conversation, other, unread, time }) => (
              <Link
                key={`${conversation.aProfileId}:${conversation.bProfileId}`}
                href={`/people/messages/${other.handle}`}
                className="flex min-w-0 items-start gap-3 px-4 py-4 hover:bg-zinc-50 sm:px-5"
              >
                {unread ? (
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--vx-accent-600)]"
                    aria-label="Unread"
                  />
                ) : (
                  <span className="mt-1.5 h-2 w-2 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm text-zinc-900 ${
                      unread ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {other.displayName}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    @{other.handle}
                  </p>
                  <p
                    className={`mt-1 truncate text-sm ${
                      unread
                        ? "font-semibold text-zinc-800"
                        : "text-zinc-600"
                    }`}
                  >
                    {conversation.lastSenderProfileId === profile.id
                      ? "You: "
                      : ""}
                    {conversation.lastPreview ?? ""}
                  </p>
                </div>
                <time className="shrink-0 whitespace-nowrap pt-0.5 text-xs text-zinc-500">
                  {time}
                </time>
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-5 py-8 text-sm text-zinc-600">
            No messages yet.{" "}
            <Link
              href="/people"
              className="font-medium text-[var(--vx-accent-600)] hover:underline"
            >
              Message someone you&apos;re connected with from their profile.
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
