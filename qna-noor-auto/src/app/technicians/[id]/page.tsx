import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/utils";
import { deleteTechnician, toggleActive } from "../actions";

export const dynamic = "force-dynamic";

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

function startOfMonth(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(1);
  return r;
}

export default async function TechnicianDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tech = await db.technician.findUnique({
    where: { id },
    include: {
      laborLines: {
        include: {
          repairOrder: {
            select: {
              id: true,
              roNumber: true,
              openedAt: true,
              status: true,
              customer: { select: { firstName: true, lastName: true } },
              vehicle: { select: { year: true, make: true, model: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      },
    },
  });
  if (!tech) return notFound();

  const weekStart = startOfWeek(new Date());
  const monthStart = startOfMonth(new Date());

  let allHours = 0;
  let weekHours = 0;
  let monthHours = 0;
  let allDollars = 0;
  for (const l of tech.laborLines) {
    const ts = l.repairOrder?.openedAt ?? l.createdAt;
    const h = l.hours || 0;
    const d = h * (l.rate || 0);
    allHours += h;
    allDollars += d;
    if (ts && new Date(ts) >= weekStart) weekHours += h;
    if (ts && new Date(ts) >= monthStart) monthHours += h;
  }

  async function setActive(active: boolean) {
    "use server";
    await toggleActive(id, active);
  }

  async function remove() {
    "use server";
    await deleteTechnician(id);
  }

  return (
    <>
      <PageHeader
        title={tech.name}
        description={
          tech.active
            ? `Technician · ${tech.initials ?? "—"}`
            : `Inactive · ${tech.initials ?? "—"}`
        }
        actions={
          <div className="flex gap-2">
            <LinkButton href={`/technicians/${id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            <LinkButton href="/technicians" variant="secondary">
              Back
            </LinkButton>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Hours this week
            </div>
            <div className="mt-2 text-2xl font-semibold text-zinc-900 tabular-nums">
              {weekHours.toFixed(1)}
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Hours this month
            </div>
            <div className="mt-2 text-2xl font-semibold text-zinc-900 tabular-nums">
              {monthHours.toFixed(1)}
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              All-time ({tech.laborLines.length} lines)
            </div>
            <div className="mt-2 text-2xl font-semibold text-zinc-900 tabular-nums">
              {allHours.toFixed(1)}
              <span className="ml-2 text-sm font-normal text-zinc-500">
                · {formatMoney(allDollars)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Labor history" />
        {tech.laborLines.length === 0 ? (
          <EmptyState
            title="No labor logged yet"
            description="Assign this tech to a labor line on a repair order to start tracking hours."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium w-24">Date</th>
                <th className="px-4 py-2 font-medium w-20">RO #</th>
                <th className="px-4 py-2 font-medium">Customer / Vehicle</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium w-20 text-right">Hrs</th>
                <th className="px-4 py-2 font-medium w-24 text-right">Rate</th>
                <th className="px-4 py-2 font-medium w-24 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {tech.laborLines.map((l) => {
                const ro = l.repairOrder;
                const v = ro?.vehicle;
                return (
                  <tr key={l.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2 text-xs text-zinc-600">
                      {formatDate(ro?.openedAt ?? l.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      {ro ? (
                        <Link
                          href={`/repair-orders/${ro.id}`}
                          className="font-medium text-zinc-900 hover:underline"
                        >
                          #{ro.roNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-700">
                      {ro?.customer
                        ? `${ro.customer.firstName} ${ro.customer.lastName}`
                        : ""}
                      {v && (
                        <div className="text-zinc-500">
                          {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">{l.description}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {l.hours.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-600">
                      ${l.rate.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMoney(l.hours * l.rate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <CardHeader title="Admin" />
        <div className="p-4 flex flex-wrap items-center gap-3 text-sm">
          {tech.active ? (
            <form action={setActive.bind(null, false)}>
              <Button type="submit" variant="secondary">
                Deactivate
              </Button>
            </form>
          ) : (
            <form action={setActive.bind(null, true)}>
              <Button type="submit" variant="secondary">
                Reactivate
              </Button>
            </form>
          )}
          <form action={remove}>
            <Button type="submit" variant="danger">
              Delete technician
            </Button>
          </form>
          <span className="text-xs text-zinc-500">
            Deleting unassigns this tech from all historical labor lines but
            leaves the lines themselves intact.
          </span>
        </div>
      </Card>
    </>
  );
}
