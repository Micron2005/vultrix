import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import VultrixLanding from "@/components/marketing/VultrixLanding";
import { Card, CardHeader, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { TRIAL_DAYS } from "@/lib/billing";
import { computeTotals, excludeDeclinedJobLines } from "@/lib/totals";
import { loadAppliedShopFeesForROs } from "@/lib/shopFees";
import { formatDate, formatMoney, fullName, vehicleLabel } from "@/lib/utils";
import {
  enabledFeatureSet,
  repairOrderNouns,
} from "@/lib/features";
import type { CurrentUser } from "@/lib/session";
import { prettyStatus } from "./appointments/AppointmentForm";
import { statusBadgeClass } from "./appointments/status";
import { computeAllVehicleReminders } from "@/lib/serviceReminders";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Logged-out visitors see the public Vultrix marketing site. Signed-in
  // tenant users see their shop dashboard. Platform SUPERADMINs (no org) are
  // sent to the admin console — there's no shop data to show them.
  const user = await getCurrentUser();
  if (!user) return <VultrixLanding trialDays={TRIAL_DAYS} />;
  if (!user.orgId) redirect("/admin");
  return <Dashboard user={user} />;
}

async function Dashboard({ user }: { user: CurrentUser }) {
  const orgId = user.orgId as string;
  const enabledFeatures = enabledFeatureSet(user);
  const nouns = repairOrderNouns(user.accountType);
  const autoShop = (user.accountType ?? "AUTO_SHOP") === "AUTO_SHOP";
  const hasCustomers = enabledFeatures.has("customers");
  const hasVehicles = enabledFeatures.has("vehicles");
  const hasRepairOrders = enabledFeatures.has("repair_orders");
  const hasInvoices = enabledFeatures.has("invoices");
  const hasRecords = hasRepairOrders || hasInvoices;
  const hasFinancials = enabledFeatures.has("financials");
  const hasSchedule = enabledFeatures.has("schedule");
  const hasReminders = enabledFeatures.has("reminders");
  const hasInventory = enabledFeatures.has("inventory");
  const hasTechnicians = enabledFeatures.has("technicians");
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [customerCount, vehicleCount, openROs, recentROs, todayAppts] =
    await Promise.all([
      hasCustomers ? db.customer.count({ where: { orgId } }) : Promise.resolve(0),
      hasVehicles ? db.vehicle.count({ where: { orgId } }) : Promise.resolve(0),
      hasRecords
        ? db.repairOrder.count({
            where: {
              orgId,
              status: { in: ["ESTIMATE", "IN_PROGRESS", "COMPLETED"] },
            },
          })
        : Promise.resolve(0),
      hasRecords
        ? db.repairOrder.findMany({
            where: { orgId },
            orderBy: { openedAt: "desc" },
            take: 8,
            include: {
              customer: true,
              vehicle: true,
              jobs: { select: { id: true, approvalStatus: true } },
              laborLines: true,
              partLines: true,
              feeLines: true,
            },
          })
        : Promise.resolve([]),
      hasSchedule
        ? db.appointment.findMany({
            where: { orgId, startsAt: { gte: dayStart, lt: dayEnd } },
            orderBy: { startsAt: "asc" },
            include: { customer: true, vehicle: true },
          })
        : Promise.resolve([]),
    ]);

  const recentShopFeesByRO = await loadAppliedShopFeesForROs(
    orgId,
    recentROs.map((ro) => {
      const t = computeTotals(excludeDeclinedJobLines(ro));
      return { id: ro.id, partsSubtotal: t.partsSubtotal, laborSubtotal: t.laborSubtotal };
    }),
  );

  const paidThisMonthROs = hasFinancials
    ? await db.repairOrder.findMany({
        where: {
          orgId,
          status: "PAID",
          closedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        include: {
          jobs: { select: { id: true, approvalStatus: true } },
          laborLines: true,
          partLines: true,
          feeLines: true,
        },
      })
    : [];
  const paidShopFeesByRO = await loadAppliedShopFeesForROs(
    orgId,
    paidThisMonthROs.map((ro) => {
      const t = computeTotals(excludeDeclinedJobLines(ro));
      return { id: ro.id, partsSubtotal: t.partsSubtotal, laborSubtotal: t.laborSubtotal };
    }),
  );
  const revenueThisMonth = paidThisMonthROs.reduce(
    (s, ro) =>
      s +
      computeTotals({ ...excludeDeclinedJobLines(ro), shopFees: paidShopFeesByRO.get(ro.id) ?? [] }).total,
    0,
  );

  // Money owed: any RO that's been invoiced but not fully paid.
  // Include INVOICED (in process) so partial payments still show up.
  // Exclude PAID and CANCELLED.
  const outstandingROs = hasInvoices
    ? await db.repairOrder.findMany({
        where: { orgId, status: "INVOICED" },
        orderBy: { invoicedAt: "asc" },
        include: {
          customer: true,
          vehicle: true,
          jobs: { select: { id: true, approvalStatus: true } },
          laborLines: true,
          partLines: true,
          feeLines: true,
          payments: true,
        },
      })
    : [];
  const outstandingShopFeesByRO = await loadAppliedShopFeesForROs(
    orgId,
    outstandingROs.map((ro) => {
      const t = computeTotals(excludeDeclinedJobLines(ro));
      return { id: ro.id, partsSubtotal: t.partsSubtotal, laborSubtotal: t.laborSubtotal };
    }),
  );
  const outstandingWithBalance = outstandingROs
    .map((ro) => {
      const total = computeTotals({
        ...excludeDeclinedJobLines(ro),
        shopFees: outstandingShopFeesByRO.get(ro.id) ?? [],
      }).total;
      const paid = ro.payments.reduce((s, p) => s + p.amount, 0);
      const balance = Math.round((total - paid) * 100) / 100;
      return { ro, total, paid, balance };
    })
    .filter((x) => x.balance > 0);
  const moneyOwed = outstandingWithBalance.reduce((s, x) => s + x.balance, 0);
  const moneyOwedIndividuals = outstandingWithBalance
    .filter((x) => x.ro.customer.type !== "BUSINESS")
    .reduce((s, x) => s + x.balance, 0);
  const moneyOwedBusinesses = outstandingWithBalance
    .filter((x) => x.ro.customer.type === "BUSINESS")
    .reduce((s, x) => s + x.balance, 0);

  // Hours this week by tech. Week starts Sunday 00:00 local time.
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const weekLaborLines = hasTechnicians
    ? await db.laborLine.findMany({
        where: {
          technicianId: { not: null },
          repairOrder: { orgId, openedAt: { gte: weekStart } },
        },
        include: { technician: true },
      })
    : [];
  const techHoursMap = new Map<
    string,
    { id: string; name: string; hours: number }
  >();
  for (const l of weekLaborLines) {
    if (!l.technician) continue;
    const cur = techHoursMap.get(l.technician.id);
    if (cur) cur.hours += l.hours;
    else
      techHoursMap.set(l.technician.id, {
        id: l.technician.id,
        name: l.technician.name,
        hours: l.hours,
      });
  }
  const hoursThisWeek = Array.from(techHoursMap.values()).sort(
    (a, b) => b.hours - a.hours,
  );

  // Low stock: any active catalog part where qtyOnHand <= reorderLevel.
  // Sort out-of-stock first, then by how deep under the threshold.
  const activeParts = hasInventory
    ? await db.part.findMany({
        where: { orgId, archived: false },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          partNumber: true,
          qtyOnHand: true,
          reorderLevel: true,
        },
      })
    : [];
  const lowStockParts = activeParts
    .filter((p) => p.qtyOnHand <= p.reorderLevel)
    .sort((a, b) => a.qtyOnHand - a.reorderLevel - (b.qtyOnHand - b.reorderLevel));

  const allReminders = hasReminders ? await computeAllVehicleReminders(orgId) : [];
  const vehiclesDue = allReminders
    .map((r) => ({
      ...r,
      overdueItems: r.items.filter((i) => i.status === "overdue"),
    }))
    .filter((r) => r.overdueItems.length > 0)
    .sort((a, b) => b.overdueItems.length - a.overdueItems.length);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of shop activity"
        actions={
          hasRecords ? (
            <LinkButton href="/repair-orders/new">
              {autoShop
                ? "New Repair Order"
                : `New ${nouns.singular.toLowerCase()}`}
            </LinkButton>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {hasCustomers && (
          <StatCard label="Customers" value={customerCount.toString()} href="/customers" />
        )}
        {hasVehicles && (
          <StatCard label="Vehicles" value={vehicleCount.toString()} href="/vehicles" />
        )}
        {hasRecords && (
          <StatCard
            label={autoShop ? "Open ROs" : `Open ${nouns.plural.toLowerCase()}`}
            value={openROs.toString()}
            href="/repair-orders"
          />
        )}
        {hasFinancials && (
          <>
            <StatCard
              label="Revenue (this month)"
              value={formatMoney(revenueThisMonth)}
            />
            <StatCard
              label={`Money owed${outstandingWithBalance.length ? ` (${outstandingWithBalance.length})` : ""}`}
              value={formatMoney(moneyOwed)}
              highlight={moneyOwed > 0}
              sublines={
                moneyOwed > 0
                  ? [
                      `Individuals · ${formatMoney(moneyOwedIndividuals)}`,
                      `Businesses · ${formatMoney(moneyOwedBusinesses)}`,
                    ]
                  : undefined
              }
            />
          </>
        )}
      </div>

      {hasSchedule && <Card className="mb-6">
        <CardHeader title={`Today's schedule (${todayAppts.length})`}>
          <LinkButton href="/appointments" variant="ghost" size="sm">
            Full week →
          </LinkButton>
          <LinkButton href="/appointments/new" size="sm">
            + New
          </LinkButton>
        </CardHeader>
        {todayAppts.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500 text-center">
            Nothing scheduled for today.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {todayAppts.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/appointments/${a.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50"
                >
                  <div className="text-sm font-semibold text-zinc-900 w-20 shrink-0">
                    {new Intl.DateTimeFormat("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(a.startsAt)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-900 truncate">
                      {a.reason}
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
                      {fullName(a.customer)}
                      {hasVehicles && a.vehicle && ` · ${vehicleLabel(a.vehicle)}`}
                    </div>
                  </div>
                  <span
                    className={
                      "text-[10px] uppercase font-semibold px-2 py-1 rounded " +
                      statusBadgeClass(a.status)
                    }
                  >
                    {prettyStatus(a.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>}

      {hasReminders && vehiclesDue.length > 0 && (
        <Card className="mb-6 border-amber-200">
          <CardHeader
            title={`Vehicles due for service (${vehiclesDue.length})`}
          >
            <LinkButton href="/vehicles" variant="ghost" size="sm">
              All vehicles →
            </LinkButton>
          </CardHeader>
          <ul className="divide-y divide-zinc-200">
            {vehiclesDue.map((r) => (
              <li key={r.vehicle.id}>
                <Link
                  href={`/vehicles/${r.vehicle.id}`}
                  className="block px-4 py-3 hover:bg-zinc-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-900 truncate">
                        {vehicleLabel(r.vehicle)}
                        {r.vehicle.licensePlate && (
                          <span className="ml-2 text-xs text-zinc-500">
                            {r.vehicle.licensePlate}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-600 truncate">
                        {r.overdueItems
                          .map((i) => `${i.interval.label} (${i.summary})`)
                          .join(" · ")}
                      </div>
                    </div>
                    <span className="rounded-full bg-red-100 text-red-800 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 shrink-0">
                      {r.overdueItems.length} overdue
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hasInventory && lowStockParts.length > 0 && (
        <Card className="mb-6 border-amber-200">
          <CardHeader
            title={`Low stock (${lowStockParts.length})`}
          >
            <LinkButton href="/inventory?filter=low" variant="ghost" size="sm">
              Full inventory →
            </LinkButton>
          </CardHeader>
          <table className="w-full text-sm">
            <thead className="bg-amber-50 text-left text-xs text-amber-900 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium">Part</th>
                <th className="px-4 py-2 font-medium">Part #</th>
                <th className="px-4 py-2 font-medium text-right">On hand</th>
                <th className="px-4 py-2 font-medium text-right">Reorder at</th>
                <th className="px-4 py-2 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {lowStockParts.map((p) => {
                const out = p.qtyOnHand <= 0;
                return (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/inventory/${p.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-600">
                      {p.partNumber ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {p.qtyOnHand}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-500 tabular-nums">
                      {p.reorderLevel}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={
                          "text-[10px] uppercase font-semibold px-2 py-1 rounded " +
                          (out
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-900")
                        }
                      >
                        {out ? "Out" : "Low"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {hasTechnicians && hoursThisWeek.length > 0 && (
        <Card className="mb-6">
          <CardHeader title={`Hours logged this week (${hoursThisWeek.length} tech${hoursThisWeek.length === 1 ? "" : "s"})`}>
            <LinkButton href="/technicians" variant="ghost" size="sm">
              Manage techs →
            </LinkButton>
          </CardHeader>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium">Technician</th>
                <th className="px-4 py-2 font-medium text-right">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {hoursThisWeek.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/technicians/${t.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {t.hours.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {hasInvoices && outstandingWithBalance.length > 0 && (
        <Card className="mb-6 border-amber-200">
          <CardHeader
            title={`Outstanding invoices (${outstandingWithBalance.length}) · ${formatMoney(moneyOwed)} owed`}
          />
          <table className="w-full text-sm">
            <thead className="bg-amber-50 text-left text-xs text-amber-900 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium">
                  {autoShop ? "RO #" : "Invoice #"}
                </th>
                <th className="px-4 py-2 font-medium">Customer</th>
                {hasVehicles && (
                  <th className="px-4 py-2 font-medium">Vehicle</th>
                )}
                <th className="px-4 py-2 font-medium">Invoiced</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
                <th className="px-4 py-2 font-medium text-right">Paid</th>
                <th className="px-4 py-2 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {outstandingWithBalance.map(({ ro, total, paid, balance }) => (
                <tr key={ro.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/repair-orders/${ro.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      #{ro.roNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span>
                        {ro.customer.type === "BUSINESS" && ro.customer.companyName
                          ? ro.customer.companyName
                          : fullName(ro.customer)}
                      </span>
                      <span
                        className={
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                          (ro.customer.type === "BUSINESS"
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-zinc-100 text-zinc-600")
                        }
                      >
                        {ro.customer.type === "BUSINESS" ? "Business" : "Individual"}
                      </span>
                    </div>
                  </td>
                  {hasVehicles && (
                    <td className="px-4 py-2">{vehicleLabel(ro.vehicle)}</td>
                  )}
                  <td className="px-4 py-2 text-zinc-500">
                    {ro.invoicedAt ? formatDate(ro.invoicedAt) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatMoney(total)}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-500">
                    {formatMoney(paid)}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-red-700">
                    {formatMoney(balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {hasRecords && (
        <Card>
          <CardHeader
            title={
              autoShop
                ? "Recent Repair Orders"
                : `Recent ${nouns.plural}`
            }
          >
            <LinkButton href="/repair-orders" variant="ghost" size="sm">
              View all →
            </LinkButton>
          </CardHeader>
          {recentROs.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">
              {autoShop
                ? "No repair orders yet. "
                : "No invoices yet. "}
              <Link href="/repair-orders/new" className="underline">
                {autoShop
                  ? "Create your first RO"
                  : "Create your first invoice"}
              </Link>
              .
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2 font-medium">
                    {autoShop ? "RO #" : "Invoice #"}
                  </th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  {hasVehicles && (
                    <th className="px-4 py-2 font-medium">Vehicle</th>
                  )}
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Opened</th>
                  <th className="px-4 py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {recentROs.map((ro) => {
                  const shopFees = recentShopFeesByRO.get(ro.id) ?? [];
                  const { total } = computeTotals({
                    ...excludeDeclinedJobLines(ro),
                    shopFees,
                  });
                  return (
                    <tr key={ro.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2">
                        <Link
                          href={`/repair-orders/${ro.id}`}
                          className="font-medium text-zinc-900 hover:underline"
                        >
                          #{ro.roNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{fullName(ro.customer)}</td>
                      {hasVehicles && (
                        <td className="px-4 py-2">{vehicleLabel(ro.vehicle)}</td>
                      )}
                      <td className="px-4 py-2">
                        <StatusBadge status={ro.status} />
                      </td>
                      <td className="px-4 py-2 text-zinc-500">
                        {formatDate(ro.openedAt)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatMoney(total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  href,
  highlight,
  sublines,
}: {
  label: string;
  value: string;
  href?: string;
  highlight?: boolean;
  sublines?: string[];
}) {
  const body = (
    <div
      className={
        "rounded-lg border p-4 shadow-sm " +
        (highlight
          ? "border-amber-200 bg-amber-50"
          : "border-zinc-200 bg-white")
      }
    >
      <div
        className={
          "text-xs font-medium uppercase tracking-wider " +
          (highlight ? "text-amber-800" : "text-zinc-500")
        }
      >
        {label}
      </div>
      <div
        className={
          "mt-2 text-2xl font-semibold " +
          (highlight ? "text-amber-900" : "text-zinc-900")
        }
      >
        {value}
      </div>
      {sublines && sublines.length > 0 && (
        <div
          className={
            "mt-2 space-y-0.5 text-xs " +
            (highlight ? "text-amber-800" : "text-zinc-500")
          }
        >
          {sublines.map((s, i) => (
            <div key={i}>{s}</div>
          ))}
        </div>
      )}
    </div>
  );
  if (href)
    return (
      <Link href={href} className="block hover:shadow-md transition-shadow">
        {body}
      </Link>
    );
  return body;
}
