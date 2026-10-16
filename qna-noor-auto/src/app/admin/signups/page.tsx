import Link from "next/link";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { DEMO_ORG_ID } from "@/lib/demo";
import { describeBilling } from "@/lib/billing";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";
import { accountTypeLabel } from "../labels";

export const dynamic = "force-dynamic";

const RANGES = [
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "all", label: "All" },
] as const;

type SignupRange = (typeof RANGES)[number]["key"];

function fmtDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isWithinRange(date: Date, days: number, now: Date): boolean {
  const timestamp = date.getTime();
  return (
    timestamp >= now.getTime() - days * 24 * 60 * 60 * 1000 &&
    timestamp <= now.getTime()
  );
}

export default async function SignupsPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string | string[] }>;
}) {
  await requireSuperadmin();
  const sp = (await searchParams) ?? {};
  const rawRange = Array.isArray(sp.range) ? sp.range[0] : sp.range;
  const range: SignupRange =
    rawRange === "30" || rawRange === "all" ? rawRange : "7";

  const orgs = await db.organization.findMany({
    where: { id: { not: DEMO_ORG_ID } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      accountType: true,
      status: true,
      createdAt: true,
      billingExempt: true,
      billingEmail: true,
      musicAddon: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      pastDueSince: true,
      users: {
        where: { role: "OWNER" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { username: true, email: true, createdAt: true },
      },
      shopSettings: {
        where: {
          key: { in: ["contactFirstName", "contactLastName", "shopPhone"] },
        },
        select: { key: true, value: true },
      },
    },
  });

  const now = new Date();
  const signups =
    range === "all"
      ? orgs
      : orgs.filter((org) => isWithinRange(org.createdAt, Number(range), now));
  const rangeLabel = RANGES.find((item) => item.key === range)?.label ?? "Last 7 days";

  return (
    <div>
      <PageHeader
        title="New signups"
        description="Accounts newest first. Signup alert emails go to SIGNUP_NOTIFY_EMAIL (or LEADS_NOTIFY_EMAIL) in Vercel."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {RANGES.map((item) => {
          const active = range === item.key;
          const count =
            item.key === "all"
              ? orgs.length
              : orgs.filter((org) =>
                  isWithinRange(org.createdAt, Number(item.key), now),
                ).length;
          return (
            <Link
              key={item.key}
              href={`/admin/signups?range=${item.key}`}
              aria-current={active ? "page" : undefined}
              className={
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
                (active
                  ? "border-[var(--vx-accent-600)] bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)]"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50")
              }
            >
              {item.label}
              <span
                className={
                  "rounded-full px-1.5 text-xs " +
                  (active ? "bg-white/20" : "bg-zinc-100 text-zinc-600")
                }
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader title={`${rangeLabel} (${signups.length})`} />
        {signups.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No new signups in this period." />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {signups.map((org) => {
              const owner = org.users[0];
              const settings = new Map(
                org.shopSettings.map((setting) => [setting.key, setting.value]),
              );
              const contactName = [
                settings.get("contactFirstName"),
                settings.get("contactLastName"),
              ]
                .map((part) => part?.trim())
                .filter(Boolean)
                .join(" ");
              const email =
                owner?.email?.trim() || org.billingEmail?.trim() || null;
              const phone = settings.get("shopPhone")?.trim();
              const isNew =
                org.createdAt.getTime() <= now.getTime() &&
                org.createdAt.getTime() > now.getTime() - 48 * 60 * 60 * 1000;

              return (
                <li key={org.id} className="min-w-0 p-4">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="min-w-0 break-words text-sm font-semibold text-zinc-900">
                        {org.name}
                      </span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                        {accountTypeLabel(org.accountType)}
                      </span>
                      {isNew && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                          New
                        </span>
                      )}
                      {org.billingExempt && (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">
                          Free account
                        </span>
                      )}
                      {org.musicAddon && (
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-800">
                          Music
                        </span>
                      )}
                      {org.status === "SUSPENDED" && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                          On hold
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-xs text-zinc-500">
                      {fmtDate(org.createdAt)}
                    </div>

                    <div className="mt-2 min-w-0 space-y-1 text-sm">
                      {contactName && (
                        <div className="break-words">
                          <span className="text-zinc-500">Contact:</span>{" "}
                          {contactName}
                        </div>
                      )}
                      {email && (
                        <div className="min-w-0 break-all">
                          <span className="text-zinc-500">Email:</span>{" "}
                          <a
                            href={`mailto:${email}`}
                            className="font-medium text-zinc-700 hover:text-zinc-900 hover:underline"
                          >
                            {email}
                          </a>
                        </div>
                      )}
                      {phone && (
                        <div className="break-words">
                          <span className="text-zinc-500">Phone:</span>{" "}
                          <a
                            href={`tel:${phone}`}
                            className="font-medium text-zinc-700 hover:text-zinc-900 hover:underline"
                          >
                            {phone}
                          </a>
                        </div>
                      )}
                      {owner?.username && (
                        <div className="break-words">
                          <span className="text-zinc-500">Username:</span>{" "}
                          {owner.username}
                        </div>
                      )}
                    </div>

                    <div className="mt-2 text-xs text-zinc-500">
                      {describeBilling(org)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
