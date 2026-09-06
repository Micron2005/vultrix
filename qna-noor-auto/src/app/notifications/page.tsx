import Link from "next/link";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { listNotifications } from "@/lib/notifications";
import { orgTimeZone } from "@/lib/orgTimezone";
import { formatInTimeZone, localCalendarDay } from "@/lib/timezone";
import { requireUser } from "@/lib/session";
import { markAllNotificationsRead } from "./actions";

function notificationDate(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function NotificationsPage() {
  const user = await requireUser();
  if (!user.orgId) return null;
  const timezone = await orgTimeZone(user.orgId);
  const [items, today] = await Promise.all([
    listNotifications(user, { limit: 100 }),
    Promise.resolve(localCalendarDay(new Date(), timezone)),
  ]);
  const todayItems = items.filter(
    (item) => localCalendarDay(item.createdAt, timezone) === today,
  );
  const earlierItems = items.filter(
    (item) => localCalendarDay(item.createdAt, timezone) !== today,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        actions={
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Mark all read
            </button>
          </form>
        }
      />
      <Card>
        <CardHeader title="Today" />
        <NotificationRows items={todayItems} timezone={timezone} />
      </Card>
      {earlierItems.length > 0 && (
        <Card>
          <CardHeader title="Earlier" />
          <NotificationRows items={earlierItems} timezone={timezone} />
        </Card>
      )}
    </div>
  );
}

function NotificationRows({
  items,
  timezone,
}: {
  items: Awaited<ReturnType<typeof listNotifications>>;
  timezone: string;
}) {
  if (!items.length) {
    return (
      <p className="px-4 py-8 text-sm text-zinc-500">
        You&apos;re all caught up.
      </p>
    );
  }
  return (
    <div className="divide-y divide-zinc-200">
      {items.map((item) => {
        const content = (
          <>
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-zinc-900">{item.title}</p>
              {!item.readAt && (
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--vx-accent-600)]"
                  aria-label="Unread"
                />
              )}
            </div>
            {item.body && <p className="mt-1 text-sm text-zinc-500">{item.body}</p>}
            <p className="mt-2 text-xs text-zinc-500">
              {notificationDate(item.createdAt, timezone)}
            </p>
          </>
        );
        return item.href ? (
          <Link
            key={item.id}
            href={item.href}
            className="block border-l-2 border-transparent px-4 py-4 hover:bg-zinc-50"
          >
            {content}
          </Link>
        ) : (
          <div key={item.id} className="border-l-2 border-transparent px-4 py-4">
            {content}
          </div>
        );
      })}
    </div>
  );
}
