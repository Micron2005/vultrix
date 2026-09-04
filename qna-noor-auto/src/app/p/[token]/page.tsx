import Link from "next/link";
import { notFound } from "next/navigation";
import { ACTIVE_RO_WHERE, db } from "@/lib/db";
import { getAllSettings } from "@/lib/shop";
import { computeTotals } from "@/lib/totals";
import { loadAppliedShopFeesForROs } from "@/lib/shopFees";
import { depositDue } from "@/lib/roTotal";
import {
  formatDate,
  formatMoney,
  fullName,
  vehicleLabel,
} from "@/lib/utils";
import { computeVehicleReminders } from "@/lib/serviceReminders";
import { formatInTimeZone, localCalendarDay } from "@/lib/timezone";
import { orgTimeZone } from "@/lib/orgTimezone";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { requestAppointment } from "./actions";
import { prettyStatus } from "@/app/appointments/AppointmentForm";
import { statusBadgeClass } from "@/app/appointments/status";

export const dynamic = "force-dynamic";

type Params = Promise<{ token: string }>;
type Search = Promise<{
  paid?: string;
  payerror?: string;
  requested?: string;
  requesterror?: string;
}>;

export default async function CustomerPortalPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: Search;
}) {
  const { token } = await params;
  const sp = (await searchParams) ?? {};

  const customer = await db.customer.findUnique({
    where: { portalToken: token },
    include: {
      vehicles: {
        orderBy: { createdAt: "desc" },
      },
      repairOrders: {
        where: ACTIVE_RO_WHERE,
        orderBy: { openedAt: "desc" },
        include: {
          vehicle: true,
          laborLines: { orderBy: { sortOrder: "asc" } },
          partLines: { orderBy: { sortOrder: "asc" } },
          feeLines: { orderBy: { sortOrder: "asc" } },
          payments: { orderBy: { paidAt: "desc" } },
        },
      },
    },
  });

  if (!customer) notFound();

  const shop = await getAllSettings(customer.orgId);
  const timezone = await orgTimeZone(customer.orgId);
  const org = await db.organization.findUnique({
    where: { id: customer.orgId },
    select: { stripeConnectChargesEnabled: true },
  });
  const canPayOnline = Boolean(org?.stripeConnectChargesEnabled);

  type ROWithDerived = (typeof customer.repairOrders)[number] & {
    total: number;
    paid: number;
    balance: number;
  };

  const shopFeesByRO = await loadAppliedShopFeesForROs(
    customer.orgId,
    customer.repairOrders.map((ro) => {
      const t = computeTotals(ro);
      return { id: ro.id, partsSubtotal: t.partsSubtotal, laborSubtotal: t.laborSubtotal };
    }),
  );
  const rosWithDerived: ROWithDerived[] = customer.repairOrders.map((ro) => {
    const shopFees = shopFeesByRO.get(ro.id) ?? [];
    const total = computeTotals({ ...ro, shopFees }).total;
    const paid = ro.payments.reduce((s, p) => s + p.amount, 0);
    const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
    return { ...ro, total, paid, balance };
  });

  const outstanding = rosWithDerived.filter(
    (ro) => ro.status === "INVOICED" && ro.balance > 0,
  );
  const totalOutstanding = outstanding.reduce((s, ro) => s + ro.balance, 0);

  const pendingEstimates = rosWithDerived.filter(
    (ro) =>
      ro.status === "ESTIMATE" &&
      ro.shareToken &&
      !ro.approvedAt &&
      !ro.estimateDeclinedAt,
  );

  const inShop = rosWithDerived.filter(
    (ro) => ro.status === "IN_PROGRESS" || (ro.status === "ESTIMATE" && ro.approvedAt),
  );
  const inShopWithDeposits = await Promise.all(
    inShop.map(async (ro) => ({ ro, depositInfo: await depositDue(ro.id) })),
  );
  const depositTotal = inShopWithDeposits.reduce(
    (sum, item) => sum + item.depositInfo.due,
    0,
  );

  const upcomingVisits = await db.appointment.findMany({
    where: {
      customerId: customer.id,
      startsAt: { gte: new Date() },
      status: { in: ["REQUESTED", "SCHEDULED", "CONFIRMED"] },
    },
    orderBy: { startsAt: "asc" },
    include: { vehicle: true },
  });

  const serviceHistory = rosWithDerived.filter(
    (ro) => ro.status === "PAID" || ro.status === "COMPLETED" || ro.status === "INVOICED",
  );

  const vehicleReminders = await Promise.all(
    customer.vehicles.map((v) => computeVehicleReminders(customer.orgId, v.id)),
  );
  const dueVehicles = vehicleReminders
    .filter((r): r is NonNullable<typeof r> => r != null)
    .map((r) => ({
      ...r,
      dueItems: r.items.filter(
        (i) => i.status === "overdue" || i.status === "soon",
      ),
    }))
    .filter((r) => r.dueItems.length > 0);

  return (
    <div className="min-h-screen bg-zinc-100 py-10" data-force-light>
      <div className="mx-auto max-w-4xl px-4 space-y-6">
        <header className="rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-6 sm:px-8 border-b border-zinc-200 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-lg font-semibold text-zinc-900">
                {shop.shopName}
              </div>
              {shop.shopAddress && (
                <div className="mt-0.5 text-xs text-zinc-600 whitespace-pre-line">
                  {shop.shopAddress}
                </div>
              )}
              {(shop.shopPhone || shop.shopEmail) && (
                <div className="mt-0.5 text-xs text-zinc-600">
                  {[shop.shopPhone, shop.shopEmail].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xs uppercase tracking-wider text-zinc-500">
                Welcome
              </div>
              <div className="text-xl font-semibold text-zinc-900">
                {fullName(customer)}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {[customer.phone, customer.email].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
        </header>

        {sp.paid && (
          <section className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 sm:px-6">
            ✓ Thank you — your payment was received. It may take a moment
            to update.
          </section>
        )}
        {sp.payerror && (
          <section className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 sm:px-6">
            Sorry, we couldn&apos;t start the payment. Please try again or
            contact the shop.
          </section>
        )}

        {depositTotal > 0 && (
          <section className="rounded-lg bg-amber-50 border border-amber-300 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-amber-900 font-semibold">
                  Deposit requested
                </div>
                <div className="mt-1 text-2xl font-semibold text-amber-900 tabular-nums">
                  {formatMoney(depositTotal)}
                </div>
                {!canPayOnline && (
                  <div className="mt-1 text-xs text-amber-800">
                    Contact the shop to pay your deposit.
                  </div>
                )}
              </div>
              <div className="w-full space-y-2 sm:w-auto">
                {inShopWithDeposits
                  .filter(({ depositInfo }) => depositInfo.due > 0)
                  .map(({ ro, depositInfo }) => (
                    <div
                      key={ro.id}
                      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <span className="text-sm text-amber-900">
                        {ro.vehicle ? vehicleLabel(ro.vehicle) : `RO #${ro.roNumber}`}
                      </span>
                      {canPayOnline && (
                        <form method="post" action={`/api/pay/${token}/${ro.id}`}>
                          <input type="hidden" name="kind" value="deposit" />
                          <button
                            type="submit"
                            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 sm:w-auto"
                          >
                            Pay {formatMoney(depositInfo.due)} deposit
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </section>
        )}

        {totalOutstanding > 0 && (
          <section className="rounded-lg bg-amber-50 border border-amber-300 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-amber-900 font-semibold">
                  Balance due
                </div>
                <div className="mt-1 text-2xl font-semibold text-amber-900 tabular-nums">
                  {formatMoney(totalOutstanding)}
                </div>
                <div className="mt-1 text-xs text-amber-800">
                  Across {outstanding.length} invoice
                  {outstanding.length === 1 ? "" : "s"}.
                </div>
              </div>
              {canPayOnline && outstanding.length > 1 && (
                <form method="post" action={`/api/pay/${token}/all`}>
                  <button
                    type="submit"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 sm:w-auto"
                  >
                    Pay all {formatMoney(totalOutstanding)}
                  </button>
                </form>
              )}
              {canPayOnline && outstanding.length === 1 && (
                <form
                  method="post"
                  action={`/api/pay/${token}/${outstanding[0].id}`}
                >
                  <button
                    type="submit"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 sm:w-auto"
                  >
                    Pay {formatMoney(totalOutstanding)} online
                  </button>
                </form>
              )}
            </div>
          </section>
        )}

        {pendingEstimates.length > 0 && (
          <section className="rounded-lg bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 sm:px-6 border-b border-zinc-200 text-sm font-semibold text-zinc-900">
              Pending estimates ({pendingEstimates.length})
            </div>
            <ul className="divide-y divide-zinc-200">
              {pendingEstimates.map((ro) => (
                <li
                  key={ro.id}
                  className="px-4 py-4 sm:px-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-900">
                      {ro.vehicle && vehicleLabel(ro.vehicle)}
                    </div>
                    {ro.complaint && (
                      <div className="mt-0.5 text-xs text-zinc-600 line-clamp-1">
                        {ro.complaint}
                      </div>
                    )}
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {formatDate(ro.openedAt)} · {formatMoney(ro.total)}
                    </div>
                  </div>
                  <Link
                    href={`/e/${ro.shareToken}`}
                    className="inline-flex h-8 items-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800"
                  >
                    Review estimate →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {inShop.length > 0 && (
          <section className="rounded-lg bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 sm:px-6 border-b border-zinc-200 text-sm font-semibold text-zinc-900">
              In the shop now ({inShop.length})
            </div>
            <ul className="divide-y divide-zinc-200">
              {inShop.map((ro) => {
                const depositInfo = inShopWithDeposits.find((item) => item.ro.id === ro.id)?.depositInfo;
                return (
                  <li
                    key={ro.id}
                    className="px-4 py-4 sm:px-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium text-zinc-900">
                        {ro.vehicle ? vehicleLabel(ro.vehicle) : `RO #${ro.roNumber}`}
                      </div>
                      {ro.complaint && (
                        <div className="mt-0.5 text-xs text-zinc-600 line-clamp-1">
                          {ro.complaint}
                        </div>
                      )}
                      <div className="mt-0.5 text-xs text-zinc-500">
                        Opened {formatDate(ro.openedAt)} · {formatMoney(ro.total)}
                        {depositInfo && depositInfo.paid > 0 && ` · Deposit paid ${formatMoney(depositInfo.paid)}`}
                      </div>
                    </div>
                    <Link
                      href={`/p/${token}/ro/${ro.id}`}
                      className="inline-flex min-h-9 items-center self-start rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50 sm:self-auto"
                    >
                      View →
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {upcomingVisits.length > 0 && (
          <section className="rounded-lg bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 sm:px-6 border-b border-zinc-200 text-sm font-semibold text-zinc-900">
              Upcoming visits
            </div>
            <ul className="divide-y divide-zinc-200">
              {upcomingVisits.map((appointment) => (
                <li key={appointment.id} className="px-4 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium text-zinc-900">
                      {formatInTimeZone(appointment.startsAt, timezone, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-semibold " +
                        statusBadgeClass(appointment.status)
                      }
                    >
                      {appointment.status === "REQUESTED"
                        ? "Requested — we'll confirm"
                        : prettyStatus(appointment.status)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-zinc-700">{appointment.reason}</div>
                  {appointment.vehicle && (
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {vehicleLabel(appointment.vehicle)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {sp.requested && (
          <section className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 sm:px-6">
            Thanks — we got your request and will confirm shortly.
          </section>
        )}
        {sp.requesterror && (
          <section className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:px-6">
            We couldn&apos;t submit your request. Please check the form and try again.
          </section>
        )}

        <section className="rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 sm:px-6 border-b border-zinc-200 text-sm font-semibold text-zinc-900">
            Request an appointment
          </div>
          <form action={requestAppointment} className="space-y-4 px-4 py-4 sm:px-6">
            <input type="hidden" name="token" value={token} />
            <Field label="Vehicle (optional)">
              <Select name="vehicleId" defaultValue="">
                <option value="">Not sure / new vehicle</option>
                {customer.vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicleLabel(vehicle)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Date *">
                <Input
                  type="date"
                  name="date"
                  required
                  min={localCalendarDay(new Date(), timezone)}
                  defaultValue={localCalendarDay(new Date(), timezone)}
                />
              </Field>
              <Field label="Time *">
                <Select name="time" required defaultValue="09:00">
                  <option value="09:00">Morning (9:00 AM)</option>
                  <option value="12:00">Midday (12:00 PM)</option>
                  <option value="15:00">Afternoon (3:00 PM)</option>
                </Select>
              </Field>
            </div>
            <Field label="What do you need? *">
              <Input
                name="reason"
                required
                maxLength={120}
                placeholder="What do you need? e.g. Oil change, brake noise"
              />
            </Field>
            <Field label="Notes (optional)">
              <Textarea name="notes" maxLength={1000} rows={3} />
            </Field>
            <button
              type="submit"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 sm:w-auto"
            >
              Request appointment
            </button>
          </form>
        </section>

        {dueVehicles.length > 0 && (
          <section className="rounded-lg bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 sm:px-6 border-b border-zinc-200 text-sm font-semibold text-zinc-900">
              Recommended next service
            </div>
            <ul className="divide-y divide-zinc-200">
              {dueVehicles.map((r) => (
                <li key={r.vehicle.id} className="px-4 py-4 sm:px-6">
                  <div className="text-sm font-medium text-zinc-900">
                    {vehicleLabel(r.vehicle)}
                    {r.vehicle.licensePlate && (
                      <span className="ml-2 text-xs text-zinc-500">
                        {r.vehicle.licensePlate}
                      </span>
                    )}
                    {r.vehicle.unitNumber && (
                      <span className="ml-2 text-xs text-zinc-500">
                        Unit {r.vehicle.unitNumber}
                      </span>
                    )}
                  </div>
                  <ul className="mt-2 space-y-1">
                    {r.dueItems.map((i) => (
                      <li
                        key={i.interval.id}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="text-zinc-800">
                          {i.interval.label}
                        </span>
                        <span
                          className={
                            "rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider text-[10px] " +
                            (i.status === "overdue"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800")
                          }
                        >
                          {i.status === "overdue" ? "Overdue" : "Due soon"}
                          {i.summary ? ` · ${i.summary}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <div className="px-4 py-2 sm:px-6 text-[11px] text-zinc-500 border-t border-zinc-200">
              Based on your vehicle&apos;s mileage and last known service.
              Contact us to schedule.
            </div>
          </section>
        )}

        {outstanding.length > 0 && (
          <section className="rounded-lg bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 sm:px-6 border-b border-zinc-200 text-sm font-semibold text-zinc-900">
              Outstanding invoices ({outstanding.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-medium text-zinc-600">
                <tr>
                  <th className="px-4 py-2 sm:px-6">Invoice</th>
                  <th className="px-4 py-2">Vehicle</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Paid</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {outstanding.map((ro) => (
                  <tr key={ro.id}>
                      <td className="px-4 py-2 sm:px-6">
                      <Link
                        href={`/p/${token}/ro/${ro.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        #{ro.roNumber}
                      </Link>
                      <div className="text-xs text-zinc-500">
                        Invoiced {formatDate(ro.invoicedAt)}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-zinc-700">
                      {ro.vehicle && vehicleLabel(ro.vehicle)}
                      {ro.vehicle?.unitNumber && ` · Unit ${ro.vehicle.unitNumber}`}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-700 tabular-nums">
                      {formatMoney(ro.total)}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-600 tabular-nums">
                      {formatMoney(ro.paid)}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-amber-900">
                      {formatMoney(ro.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 sm:px-6 border-b border-zinc-200 text-sm font-semibold text-zinc-900">
            Service history ({serviceHistory.length})
          </div>
          {serviceHistory.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">
              No service history yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-medium text-zinc-600">
                <tr>
                  <th className="px-4 py-2 sm:px-6">Date</th>
                  <th className="px-4 py-2">RO</th>
                  <th className="px-4 py-2">Vehicle</th>
                  <th className="px-4 py-2">Service</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {serviceHistory.map((ro) => (
                  <tr key={ro.id}>
                    <td className="px-4 py-2 sm:px-6 text-zinc-600">
                      {formatDate(ro.closedAt ?? ro.invoicedAt ?? ro.openedAt)}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/p/${token}/ro/${ro.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        #{ro.roNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-700">
                      {ro.vehicle && vehicleLabel(ro.vehicle)}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 max-w-[260px] truncate">
                      {ro.complaint ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-zinc-600">
                      {ro.status === "PAID"
                        ? "Paid"
                        : ro.status === "COMPLETED"
                          ? "Completed"
                          : "Invoiced"}
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">
                      {formatMoney(ro.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 sm:px-6 border-b border-zinc-200 text-sm font-semibold text-zinc-900">
            My vehicles ({customer.vehicles.length})
          </div>
          {customer.vehicles.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">
              No vehicles on file.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {customer.vehicles.map((v) => (
                <li key={v.id} className="px-4 py-3 sm:px-6">
                  <div className="text-sm font-medium text-zinc-900">
                    {vehicleLabel(v)}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {v.licensePlate && (
                      <span className="mr-3">Plate: {v.licensePlate}</span>
                    )}
                    {v.vin && (
                      <span className="mr-3 font-mono">VIN: {v.vin}</span>
                    )}
                    {typeof v.mileage === "number" && (
                      <span>Mileage: {v.mileage.toLocaleString()}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="text-center text-xs text-zinc-500 pt-2">
          Questions? Contact{" "}
          {shop.shopPhone || shop.shopEmail || shop.shopName}.
        </footer>
      </div>
    </div>
  );
}
