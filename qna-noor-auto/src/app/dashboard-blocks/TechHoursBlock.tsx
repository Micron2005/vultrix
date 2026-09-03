import Link from "next/link";
import { Card, CardHeader, LinkButton } from "@/components/ui";
import { db } from "@/lib/db";

export async function TechHoursBlock({
  orgId,
  title,
}: {
  orgId: string;
  title?: string;
}) {
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekLaborLines = await db.laborLineTech.findMany({
    where: {
      laborLine: { repairOrder: { orgId, openedAt: { gte: weekStart } } },
    },
    include: { technician: true },
  });
  const techHoursMap = new Map<
    string,
    { id: string; name: string; hours: number }
  >();
  for (const assignment of weekLaborLines) {
    const tech = assignment.technician;
    const current = techHoursMap.get(tech.id);
    if (current) current.hours += assignment.hours;
    else
      techHoursMap.set(tech.id, {
        id: tech.id,
        name: tech.name,
        hours: assignment.hours,
      });
  }
  const hoursThisWeek = Array.from(techHoursMap.values()).sort(
    (a, b) => b.hours - a.hours,
  );
  if (hoursThisWeek.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader
        title={
          title ??
          `Hours logged this week (${hoursThisWeek.length} tech${hoursThisWeek.length === 1 ? "" : "s"})`
        }
      >
        <LinkButton href="/technicians" variant="ghost" size="sm">
          Manage techs →
        </LinkButton>
      </CardHeader>
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="px-4 py-2 font-medium">Technician</th>
            <th className="px-4 py-2 text-right font-medium">Hours</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {hoursThisWeek.map((technician) => (
            <tr key={technician.id} className="hover:bg-zinc-50">
              <td className="px-4 py-2">
                <Link
                  href={`/technicians/${technician.id}`}
                  className="font-medium text-zinc-900 hover:underline"
                >
                  {technician.name}
                </Link>
              </td>
              <td className="px-4 py-2 text-right font-semibold">
                {technician.hours.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
