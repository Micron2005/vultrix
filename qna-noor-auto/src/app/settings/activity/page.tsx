import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardHeader, PageHeader, Select } from "@/components/ui";
import { LocalDateTime } from "@/components/LocalDateTime";
import { activityLabel } from "@/lib/activity";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string;
    user?: string;
    action?: string;
  }>;
}) {
  const me = await requireUser();
  if (!me.orgId) redirect("/admin");
  if (me.role !== "OWNER" && me.role !== "ADMIN") redirect("/settings");

  const sp = (await searchParams) ?? {};
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const username = sp.user?.trim() ?? "";
  const action = sp.action?.trim() ?? "";
  const where = {
    orgId: me.orgId,
    ...(username ? { username } : {}),
    ...(action ? { action } : {}),
  };

  const [total, entries, users, actions] = await Promise.all([
    db.activityLog.count({ where }),
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.activityLog.findMany({
      where: { orgId: me.orgId },
      distinct: ["username"],
      orderBy: { username: "asc" },
      select: { username: true },
    }),
    db.activityLog.findMany({
      where: { orgId: me.orgId },
      distinct: ["action"],
      orderBy: { action: "asc" },
      select: { action: true },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const query = (nextPage: number) => {
    const params = new URLSearchParams();
    if (username) params.set("user", username);
    if (action) params.set("action", action);
    if (nextPage > 1) params.set("page", String(nextPage));
    const search = params.toString();
    return `/settings/activity${search ? `?${search}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Activity log"
        description={`Accountability history for ${me.orgName ?? "your business"}.`}
      />

      <Card className="mb-6">
        <CardHeader title="Filter activity" />
        <form method="get" className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              User
            </label>
            <Select name="user" defaultValue={username}>
              <option value="">All users</option>
              {users.map((entry) => (
                <option key={entry.username} value={entry.username}>
                  {entry.username}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              Action
            </label>
            <Select name="action" defaultValue={action}>
              <option value="">All actions</option>
              {actions.map((entry) => (
                <option key={entry.action} value={entry.action}>
                  {activityLabel(entry.action)}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-[var(--vx-accent-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--vx-accent-700)]"
            >
              Apply filters
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title={`${total} entr${total === 1 ? "y" : "ies"}`} />
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action / entity</th>
                <th className="px-4 py-3 font-medium">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                    <LocalDateTime value={entry.createdAt} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-900">
                    {entry.username}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                    <div>{activityLabel(entry.action)}</div>
                    <div className="text-xs text-zinc-400">{entry.entity}</div>
                  </td>
                  <td className="min-w-[20rem] px-4 py-3 text-zinc-700">
                    {entry.summary}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-zinc-500">
                    No activity matches these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-sm">
          <span className="text-zinc-500">
            Page {Math.min(page, pageCount)} of {pageCount}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={query(page - 1)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
              >
                Previous
              </Link>
            )}
            {page < pageCount && (
              <Link
                href={query(page + 1)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
