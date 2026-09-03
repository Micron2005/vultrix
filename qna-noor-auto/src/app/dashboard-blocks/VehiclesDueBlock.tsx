import Link from "next/link";
import { Card, CardHeader, LinkButton } from "@/components/ui";
import { computeAllVehicleReminders } from "@/lib/serviceReminders";
import { vehicleLabel } from "@/lib/utils";

export async function VehiclesDueBlock({
  orgId,
  title,
}: {
  orgId: string;
  title?: string;
}) {
  const allReminders = await computeAllVehicleReminders(orgId);
  const vehiclesDue = allReminders
    .map((reminder) => ({
      ...reminder,
      overdueItems: reminder.items.filter((item) => item.status === "overdue"),
    }))
    .filter((reminder) => reminder.overdueItems.length > 0)
    .sort((a, b) => b.overdueItems.length - a.overdueItems.length);
  if (vehiclesDue.length === 0) return null;

  return (
    <Card className="mb-6 border-amber-200">
      <CardHeader title={title ?? `Vehicles due for service (${vehiclesDue.length})`}>
        <LinkButton href="/vehicles" variant="ghost" size="sm">
          All vehicles →
        </LinkButton>
      </CardHeader>
      <ul className="divide-y divide-zinc-200">
        {vehiclesDue.map((reminder) => (
          <li key={reminder.vehicle.id}>
            <Link
              href={`/vehicles/${reminder.vehicle.id}`}
              className="block px-4 py-3 hover:bg-zinc-50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-900">
                    {vehicleLabel(reminder.vehicle)}
                    {reminder.vehicle.licensePlate && (
                      <span className="ml-2 text-xs text-zinc-500">
                        {reminder.vehicle.licensePlate}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-zinc-600">
                    {reminder.overdueItems
                      .map((item) => `${item.interval.label} (${item.summary})`)
                      .join(" · ")}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-800">
                  {reminder.overdueItems.length} overdue
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
