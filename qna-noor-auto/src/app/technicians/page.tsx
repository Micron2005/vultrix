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

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const day = r.getDay(); // 0 = Sun
  r.setDate(r.getDate() - day);
  return r;
}

export default async function TechniciansPage() {
  const orgId = await requireOrgId();
  const techs = await db.technician.findMany({
    where: { orgId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      laborLines: {
        include: {
          repairOrder: { select: { id: true, roNumber: true, openedAt: true } },
        },
      },
    },
  });

  const weekStart = startOfWeek(new Date());

  const rows = techs.map((t) => {
    let allHours = 0;
    let weekHours = 0;
    for (const l of t.laborLines) {
      allHours += l.hours || 0;
      const ts = l.repairOrder?.openedAt ?? l.createdAt;
      if (ts && new Date(ts) >= weekStart) {
        weekHours += l.hours || 0;
      }
    }
    return { t, allHours, weekHours, jobs: t.laborLines.length };
  });

  return (
    <>
      <PageHeader
        title="Technicians"
        description="Who works in the shop. Assign techs to labor lines to track hours per person."
        actions={<LinkButton href="/technicians/new">Add technician</LinkButton>}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No technicians yet"
          description="Add the people who turn wrenches so you can assign labor lines to them."
          action={<LinkButton href="/technicians/new">Add technician</LinkButton>}
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium w-20">Initials</th>
                <th className="px-4 py-2 font-medium w-28">Default rate</th>
                <th className="px-4 py-2 font-medium w-24 text-right">
                  Hrs this wk
                </th>
                <th className="px-4 py-2 font-medium w-24 text-right">
                  Hrs all-time
                </th>
                <th className="px-4 py-2 font-medium w-20">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {rows.map(({ t, allHours, weekHours }) => (
                <tr key={t.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/technicians/${t.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {t.name}
                    </Link>
                    {t.notes && (
                      <div className="text-xs text-zinc-500 line-clamp-1">
                        {t.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-600">
                    {t.initials ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-600">
                    {t.defaultRate != null
                      ? `$${t.defaultRate.toFixed(2)}/hr`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {weekHours > 0 ? weekHours.toFixed(1) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {allHours > 0 ? allHours.toFixed(1) : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {t.active ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5">
                        Inactive
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
