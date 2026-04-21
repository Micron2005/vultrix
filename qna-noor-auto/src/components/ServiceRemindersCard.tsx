import { Card, CardHeader } from "@/components/ui";
import type { VehicleWithReminders } from "@/lib/serviceReminders";
import { formatDate } from "@/lib/utils";
import {
  markServiceDone,
  deleteServiceLog,
} from "@/app/vehicles/[id]/serviceActions";

function statusPill(status: "overdue" | "soon" | "ok") {
  if (status === "overdue")
    return (
      <span className="rounded-full bg-red-100 text-red-800 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5">
        Overdue
      </span>
    );
  if (status === "soon")
    return (
      <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5">
        Due soon
      </span>
    );
  return (
    <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5">
      OK
    </span>
  );
}

export function ServiceRemindersCard({
  data,
}: {
  data: VehicleWithReminders;
}) {
  const overdue = data.items.filter((i) => i.status === "overdue");
  const soon = data.items.filter((i) => i.status === "soon");
  const ok = data.items.filter((i) => i.status === "ok");
  const vehicleId = data.vehicle.id;
  const currentMileage = data.currentMileage;

  return (
    <Card className="mb-4">
      <CardHeader
        title={`Recommended service${
          overdue.length > 0 ? ` (${overdue.length} overdue)` : ""
        }`}
      />
      <div className="px-4 py-3 text-xs text-zinc-500 border-b border-zinc-200">
        Based on{" "}
        {currentMileage != null
          ? `${currentMileage.toLocaleString()} mi current mileage`
          : "no recorded mileage yet"}
        . Times shown are since last known service.
      </div>
      <ul className="divide-y divide-zinc-200">
        {[...overdue, ...soon, ...ok].map((it) => (
          <li key={it.interval.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-zinc-900">
                    {it.interval.label}
                  </div>
                  {statusPill(it.status)}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  Every{" "}
                  {it.interval.everyMiles != null
                    ? `${it.interval.everyMiles.toLocaleString()} mi`
                    : null}
                  {it.interval.everyMiles != null &&
                  it.interval.everyMonths != null
                    ? " / "
                    : null}
                  {it.interval.everyMonths != null
                    ? `${it.interval.everyMonths} months`
                    : null}
                  {it.lastLog && (
                    <>
                      {" · Last: "}
                      {formatDate(it.lastLog.performedAt)}
                      {it.lastLog.atMileage != null
                        ? ` at ${it.lastLog.atMileage.toLocaleString()} mi`
                        : ""}
                    </>
                  )}
                </div>
                <div className="mt-1 text-xs text-zinc-700">{it.summary}</div>
              </div>
              <form
                action={markServiceDone}
                className="flex items-center gap-1 shrink-0"
              >
                <input type="hidden" name="vehicleId" value={vehicleId} />
                <input
                  type="hidden"
                  name="intervalId"
                  value={it.interval.id}
                />
                <input
                  type="number"
                  name="atMileage"
                  placeholder={
                    currentMileage != null
                      ? currentMileage.toLocaleString()
                      : "mi"
                  }
                  className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-xs"
                />
                <button
                  type="submit"
                  className="rounded-md bg-zinc-900 text-white text-xs font-medium px-2 py-1 hover:bg-zinc-800"
                >
                  Mark done
                </button>
              </form>
            </div>
            {it.lastLog && (
              <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
                <form action={deleteServiceLog}>
                  <input
                    type="hidden"
                    name="logId"
                    value={it.lastLog.id}
                  />
                  <input
                    type="hidden"
                    name="vehicleId"
                    value={vehicleId}
                  />
                  <button
                    type="submit"
                    className="underline hover:text-zinc-600"
                  >
                    Undo last log
                  </button>
                </form>
              </div>
            )}
          </li>
        ))}
        {data.items.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-zinc-500">
            No service intervals configured.
          </li>
        )}
      </ul>
    </Card>
  );
}
