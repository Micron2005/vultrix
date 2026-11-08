import Link from "next/link";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { SUPPORT_EMAIL } from "@/lib/branding";
import { collectRecipients } from "@/lib/announcements";
import { DEMO_ORG_ID } from "@/lib/demoIds";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";
import { AnnouncementComposer } from "./AnnouncementComposer";
import { createAnnouncementDraft } from "./actions";

export const dynamic = "force-dynamic";

type Counts = { sent: number; failed: number; pending: number };

function statusLabel(status: string): string {
  if (status === "sending") return "Sending";
  if (status === "sent") return "Sent";
  return "Draft";
}

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string | string[] }>;
}) {
  await requireSuperadmin();
  const params = (await searchParams) ?? {};
  const requestedId = Array.isArray(params.id) ? params.id[0] : params.id;
  const announcements = await db.announcement.findMany({
    orderBy: { createdAt: "desc" },
  });
  const selected =
    announcements.find((announcement) => announcement.id === requestedId) ??
    announcements.find((announcement) => announcement.status === "draft") ??
    null;
  const counts = new Map<string, Counts>();
  const grouped = announcements.length
    ? await db.announcementRecipient.groupBy({
        by: ["announcementId", "status"],
        where: {
          announcementId: { in: announcements.map((announcement) => announcement.id) },
        },
        _count: { _all: true },
      })
    : [];
  for (const announcement of announcements) {
    counts.set(announcement.id, { sent: 0, failed: 0, pending: 0 });
  }
  for (const item of grouped) {
    const value = counts.get(item.announcementId);
    if (!value) continue;
    if (item.status === "sent") value.sent = item._count._all;
    if (item.status === "failed") value.failed = item._count._all;
    if (item.status === "pending") value.pending = item._count._all;
  }

  const orgs = selected?.status === "draft"
    ? await db.organization.findMany({
        where: { id: { not: DEMO_ORG_ID } },
        orderBy: { id: "asc" },
        select: {
          id: true,
          announcementsOptOut: true,
          billingEmail: true,
          users: {
            where: { role: "OWNER" },
            orderBy: { createdAt: "asc" },
            select: { role: true, email: true },
          },
        },
      })
    : [];
  const recipientCount = collectRecipients(orgs).length;
  const selectedCounts = selected
    ? counts.get(selected.id) ?? { sent: 0, failed: 0, pending: 0 }
    : { sent: 0, failed: 0, pending: 0 };
  const failedRecipients = selected
    ? await db.announcementRecipient.findMany({
        where: { announcementId: selected.id, status: "failed" },
        orderBy: { email: "asc" },
        select: { email: true, error: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Write a platform announcement and send it to Vultrix account owners."
      />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader title="Previous announcements" />
          <div className="space-y-3 p-4">
            <form action={createAnnouncementDraft}>
              <button
                type="submit"
                className="w-full rounded-md bg-[var(--vx-accent-600)] px-3 py-2 text-sm font-semibold text-[var(--vx-accent-fg)]"
              >
                New announcement
              </button>
            </form>
            {announcements.length === 0 ? (
              <EmptyState title="No announcements yet." />
            ) : (
              <ul className="divide-y divide-zinc-200">
                {announcements.map((announcement) => {
                  const count = counts.get(announcement.id) ?? {
                    sent: 0,
                    failed: 0,
                    pending: 0,
                  };
                  const active = selected?.id === announcement.id;
                  return (
                    <li key={announcement.id}>
                      <Link
                        href={`/admin/announcements?id=${encodeURIComponent(announcement.id)}`}
                        aria-current={active ? "page" : undefined}
                        className={`block min-w-0 rounded-md px-3 py-3 ${active ? "bg-zinc-100" : "hover:bg-zinc-50"}`}
                      >
                        <span className="block break-words text-sm font-semibold text-zinc-900">
                          {announcement.subject}
                        </span>
                        <span className="mt-1 block text-xs text-zinc-500">
                          {statusLabel(announcement.status)} · {count.sent} sent ·{" "}
                          {count.failed} failed
                          {announcement.status === "sending" &&
                            ` · ${count.pending} left`}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card className="min-w-0">
          <CardHeader
            title={selected ? "Announcement" : "Compose an announcement"}
          />
          <div className="min-w-0 space-y-5 p-4 sm:p-6">
            {selected ? (
              <AnnouncementComposer
                key={selected.id}
                announcement={{
                  id: selected.id,
                  subject: selected.subject,
                  body: selected.body,
                  status:
                    selected.status === "sending" || selected.status === "sent"
                      ? selected.status
                      : "draft",
                  testSentAt: selected.testSentAt?.toISOString() ?? null,
                  testSentTo: selected.testSentTo,
                }}
                recipientCount={recipientCount}
                sentCount={selectedCounts.sent}
                failedCount={selectedCounts.failed}
                pendingCount={selectedCounts.pending}
                failedRecipients={failedRecipients}
                supportEmail={SUPPORT_EMAIL}
              />
            ) : (
              <p className="text-sm text-zinc-600">
                Create a draft to start writing. New drafts are prefilled with the
                current Vultrix announcement.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
