import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import {
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CannedJobsListPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const orgId = await requireOrgId();
  const sp = await searchParams;
  const showArchived = sp.archived === "1";

  const jobs = await db.cannedJob.findMany({
    where: { orgId, archived: showArchived },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      laborItems: { select: { id: true, hours: true } },
      partItems: { select: { id: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Presets"
        description="Reusable canned jobs — drop labor and parts onto an RO in one click."
        actions={
          <>
            <LinkButton
              href={`/canned-jobs${showArchived ? "" : "?archived=1"}`}
              variant="ghost"
            >
              {showArchived ? "Active" : "Archived"}
            </LinkButton>
            <LinkButton href="/canned-jobs/new">+ New preset</LinkButton>
          </>
        }
      />

      {jobs.length === 0 ? (
        <EmptyState
          title={showArchived ? "No archived presets." : "No presets yet."}
          description={
            showArchived
              ? "Presets you archive will show up here."
              : "Save common jobs so you don't have to re-type labor and parts every time."
          }
          action={
            showArchived ? null : (
              <LinkButton href="/canned-jobs/new">+ New preset</LinkButton>
            )
          }
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium">Preset</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium text-right">Labor items</th>
                <th className="px-4 py-2 font-medium text-right">Parts</th>
                <th className="px-4 py-2 font-medium text-right">Total hrs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {jobs.map((j) => {
                const hours = j.laborItems.reduce((s, l) => s + l.hours, 0);
                return (
                  <tr key={j.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/canned-jobs/${j.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {j.name}
                      </Link>
                      {j.description && (
                        <div className="text-xs text-zinc-500 line-clamp-1 mt-0.5">
                          {j.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-zinc-600">
                      {j.category ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-600">
                      {j.laborItems.length}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-600">
                      {j.partItems.length}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-600">
                      {hours.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
