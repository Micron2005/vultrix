import Link from "next/link";
import { Card, CardHeader, LinkButton, Table, TBody, TD, THead, TR } from "@/components/ui";
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
      <Table>
        <THead>
          <tr>
            <th className="px-4 py-2 font-medium">Technician</th>
            <th className="px-4 py-2 text-right font-medium">Hours</th>
          </tr>
        </THead>
        <TBody>
          {hoursThisWeek.map((technician) => (
            <TR key={technician.id}>
              <TD>
                <Link
                  href={`/technicians/${technician.id}`}
                  className="font-medium text-zinc-900 hover:underline"
                >
                  {technician.name}
                </Link>
              </TD>
              <TD numeric className="font-semibold">
                {technician.hours.toFixed(1)}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
