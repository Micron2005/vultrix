import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser, requireOrgId } from "@/lib/session";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { formatMoney, fullName, vehicleLabel } from "@/lib/utils";
import { findNormalizedSearchMatches } from "@/lib/search";
import { enabledFeatureSet, repairOrderNouns } from "@/lib/features";
import { canViewFinancials } from "@/lib/permissions";
import { formatInTimeZone } from "@/lib/timezone";
import { orgTimeZone } from "@/lib/orgTimezone";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string }>;

function highlight(s: string, tokens: string[]) {
  if (!s || tokens.length === 0) return s;
  const lower = s.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const t of tokens) {
    const lt = t.toLowerCase();
    if (!lt) continue;
    let from = 0;
    while (from <= lower.length) {
      const i = lower.indexOf(lt, from);
      if (i < 0) break;
      ranges.push([i, i + lt.length]);
      from = i + lt.length;
    }
  }
  if (ranges.length === 0) return s;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) {
      last[1] = Math.max(last[1], r[1]);
    } else {
      merged.push([r[0], r[1]]);
    }
  }
  const out: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([a, b], idx) => {
    if (a > cursor) out.push(s.slice(cursor, a));
    out.push(
      <mark
        key={idx}
        className="rounded bg-amber-200 px-0.5 text-amber-950 dark:bg-amber-500/30 dark:text-amber-100"
      >
        {s.slice(a, b)}
      </mark>,
    );
    cursor = b;
  });
  if (cursor < s.length) out.push(s.slice(cursor));
  return <>{out}</>;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const orgId = await requireOrgId();
  const user = await getCurrentUser();
  if (!user) return null;
  const features = enabledFeatureSet(user);
  const accountType = user.accountType ?? "AUTO_SHOP";
  const hasCustomers = features.has("customers");
  const hasVehicles = features.has("vehicles");
  const hasRepairOrders =
    features.has("repair_orders") || features.has("invoices");
  const hasNotes = features.has("knowledge");
  const hasParts = features.has("inventory");
  const hasAppointments = features.has("schedule");
  const hasSales =
    features.has("financials") &&
    !features.has("invoices") &&
    canViewFinancials(user.role);
  const nouns = repairOrderNouns(accountType);
  const enabledSections = [
    hasCustomers ? "customers" : null,
    hasVehicles ? "vehicles" : null,
    hasRepairOrders ? nouns.plural.toLowerCase() : null,
    hasNotes ? "knowledge notes" : null,
    hasParts ? "parts" : null,
    hasAppointments ? "appointments" : null,
    hasSales ? "sales" : null,
  ].filter((section): section is string => Boolean(section));
  const enabledSearchText =
    enabledSections.length > 0 ? enabledSections.join(", ") : "available records";
  const { q: qRaw } = await searchParams;
  const q = (qRaw ?? "").trim();

  if (!q) {
    return (
      <>
        <PageHeader title="Search" />
        <Card>
          <div className="p-6 text-sm text-zinc-600 dark:text-zinc-400">
            Search {enabledSearchText} by name or matching details using the
            search bar in the sidebar.
          </div>
        </Card>
      </>
    );
  }

  const tokens = q.split(/\s+/).filter((t) => t.length > 0);
  const { customerIdsByToken, vehicleIdsByToken } =
    await findNormalizedSearchMatches(orgId, tokens, {
      customers: hasCustomers,
      vehicles: hasVehicles,
    });

  const customerAnd = tokens.map((t, index) => ({
    OR: [
      { firstName: { contains: t, mode: "insensitive" as const } },
      { lastName: { contains: t, mode: "insensitive" as const } },
      { companyName: { contains: t, mode: "insensitive" as const } },
      { email: { contains: t, mode: "insensitive" as const } },
      {
        contacts: {
          some: { value: { contains: t, mode: "insensitive" as const } },
        },
      },
      { phone: { contains: t, mode: "insensitive" as const } },
      { altPhone: { contains: t, mode: "insensitive" as const } },
      ...(customerIdsByToken[index].length > 0
        ? [{ id: { in: customerIdsByToken[index] } }]
        : []),
    ],
  }));

  const vehicleAnd = tokens.map((t, index) => ({
    OR: [
      { vin: { contains: t, mode: "insensitive" as const } },
      { make: { contains: t, mode: "insensitive" as const } },
      { model: { contains: t, mode: "insensitive" as const } },
      { trim: { contains: t, mode: "insensitive" as const } },
      {
        licensePlate: { contains: t, mode: "insensitive" as const },
      },
      { unitNumber: { contains: t, mode: "insensitive" as const } },
      { color: { contains: t, mode: "insensitive" as const } },
      { notes: { contains: t, mode: "insensitive" as const } },
      {
        customer: {
          firstName: { contains: t, mode: "insensitive" as const },
        },
      },
      {
        customer: {
          lastName: { contains: t, mode: "insensitive" as const },
        },
      },
      {
        customer: {
          companyName: { contains: t, mode: "insensitive" as const },
        },
      },
      ...(customerIdsByToken[index].length > 0
        ? [{ customerId: { in: customerIdsByToken[index] } }]
        : []),
      ...(vehicleIdsByToken[index].length > 0
        ? [{ id: { in: vehicleIdsByToken[index] } }]
        : []),
    ],
  }));

  const roAnd = tokens.map((t, index) => {
    const parsedNumber = /^\d+$/.test(t) ? Number(t) : null;
    const asNumber =
      parsedNumber !== null &&
      Number.isSafeInteger(parsedNumber) &&
      parsedNumber <= 2147483647
        ? parsedNumber
        : null;
    return {
      OR: [
        ...(asNumber !== null ? [{ roNumber: asNumber }] : []),
        { complaint: { contains: t, mode: "insensitive" as const } },
        { cause: { contains: t, mode: "insensitive" as const } },
        { correction: { contains: t, mode: "insensitive" as const } },
        { notes: { contains: t, mode: "insensitive" as const } },
        {
          customer: {
            firstName: { contains: t, mode: "insensitive" as const },
          },
        },
        {
          customer: {
            lastName: { contains: t, mode: "insensitive" as const },
          },
        },
        {
          customer: {
            companyName: { contains: t, mode: "insensitive" as const },
          },
        },
        {
          customer: {
            email: { contains: t, mode: "insensitive" as const },
          },
        },
        { vehicle: { make: { contains: t, mode: "insensitive" as const } } },
        { vehicle: { model: { contains: t, mode: "insensitive" as const } } },
        { vehicle: { vin: { contains: t, mode: "insensitive" as const } } },
        {
          vehicle: {
            licensePlate: { contains: t, mode: "insensitive" as const },
          },
        },
        {
          vehicle: {
            unitNumber: { contains: t, mode: "insensitive" as const },
          },
        },
        ...(customerIdsByToken[index].length > 0
          ? [{ customerId: { in: customerIdsByToken[index] } }]
          : []),
        ...(vehicleIdsByToken[index].length > 0
          ? [{ vehicleId: { in: vehicleIdsByToken[index] } }]
          : []),
      ],
    };
  });

  const noteAnd = tokens.map((t) => ({
    OR: [
      { title: { contains: t, mode: "insensitive" as const } },
      { make: { contains: t, mode: "insensitive" as const } },
      { model: { contains: t, mode: "insensitive" as const } },
      { engine: { contains: t, mode: "insensitive" as const } },
      { symptom: { contains: t, mode: "insensitive" as const } },
      { diagnosis: { contains: t, mode: "insensitive" as const } },
      { fix: { contains: t, mode: "insensitive" as const } },
      { partsNotes: { contains: t, mode: "insensitive" as const } },
      { tags: { contains: t, mode: "insensitive" as const } },
    ],
  }));

  const partAnd = tokens.map((t) => ({
    OR: [
      { name: { contains: t, mode: "insensitive" as const } },
      { partNumber: { contains: t, mode: "insensitive" as const } },
      { description: { contains: t, mode: "insensitive" as const } },
      { category: { contains: t, mode: "insensitive" as const } },
      { location: { contains: t, mode: "insensitive" as const } },
      { source: { contains: t, mode: "insensitive" as const } },
      { notes: { contains: t, mode: "insensitive" as const } },
    ],
  }));

  const appointmentAnd = tokens.map((t) => ({
    OR: [
      { reason: { contains: t, mode: "insensitive" as const } },
      { notes: { contains: t, mode: "insensitive" as const } },
      {
        customer: {
          firstName: { contains: t, mode: "insensitive" as const },
        },
      },
      {
        customer: {
          lastName: { contains: t, mode: "insensitive" as const },
        },
      },
      {
        customer: {
          companyName: { contains: t, mode: "insensitive" as const },
        },
      },
    ],
  }));

  const saleAnd = tokens.map((t) => ({
    OR: [
      { itemName: { contains: t, mode: "insensitive" as const } },
      { channel: { contains: t, mode: "insensitive" as const } },
      { note: { contains: t, mode: "insensitive" as const } },
    ],
  }));

  const timezone = await orgTimeZone(orgId);
  const [customers, vehicles, repairOrders, notes, parts, appointments, sales] =
    await Promise.all([
      hasCustomers
        ? db.customer.findMany({
            where: { orgId, AND: customerAnd },
            orderBy: { lastName: "asc" },
            include: {
              contacts: {
                orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
              },
            },
            take: 20,
          })
        : Promise.resolve([]),
      hasVehicles
        ? db.vehicle.findMany({
            where: { orgId, AND: vehicleAnd },
            include: { customer: true },
            orderBy: { updatedAt: "desc" },
            take: 20,
          })
        : Promise.resolve([]),
      hasRepairOrders
        ? db.repairOrder.findMany({
            where: { orgId, AND: roAnd },
            include: { customer: true, vehicle: true },
            orderBy: { openedAt: "desc" },
            take: 20,
          })
        : Promise.resolve([]),
      hasNotes
        ? db.repairNote.findMany({
            where: { orgId, AND: noteAnd },
            orderBy: { updatedAt: "desc" },
            take: 20,
          })
        : Promise.resolve([]),
      hasParts
        ? db.part.findMany({
            where: { orgId, archived: false, AND: partAnd },
            orderBy: { updatedAt: "desc" },
            take: 20,
          })
        : Promise.resolve([]),
      hasAppointments
        ? db.appointment.findMany({
            where: { orgId, AND: appointmentAnd },
            include: { customer: true },
            orderBy: { startsAt: "desc" },
            take: 20,
          })
        : Promise.resolve([]),
      hasSales
        ? db.sale.findMany({
            where: { orgId, AND: saleAnd },
            orderBy: { soldAt: "desc" },
            take: 20,
          })
        : Promise.resolve([]),
    ]);

  const totalCount =
    customers.length +
    vehicles.length +
    repairOrders.length +
    notes.length +
    parts.length +
    appointments.length +
    sales.length;

  return (
    <>
      <PageHeader
        title={`Search: ${q}`}
        description={
          totalCount === 0
            ? "No matches found."
            : `${totalCount} match${totalCount === 1 ? "" : "es"} across ${enabledSections.join(", ")}.`
        }
      />

      {totalCount === 0 && (
        <Card>
          <div className="p-6 text-sm text-zinc-600 dark:text-zinc-400">
            Nothing matched <span className="font-mono">{q}</span>. Try a
            different search term.
          </div>
        </Card>
      )}

      {hasCustomers && customers.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={`Customers (${customers.length})`} />
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {customers.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/customers/${c.id}`}
                  className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {highlight(fullName(c), tokens)}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {[
                      ...c.contacts.map((contact) => contact.value),
                      c.phone,
                      c.altPhone,
                      c.email,
                    ]
                      .filter(
                        (value, index, values) =>
                          value && values.indexOf(value) === index,
                      )
                      .map((v) => (
                        <span key={v as string} className="mr-3">
                          {highlight(v as string, tokens)}
                        </span>
                      ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hasVehicles && vehicles.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={`Vehicles (${vehicles.length})`} />
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {vehicles.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/vehicles/${v.id}`}
                  className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {highlight(vehicleLabel(v), tokens)}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {v.licensePlate && (
                      <span className="mr-3">
                        Plate {highlight(v.licensePlate, tokens)}
                      </span>
                    )}
                    {v.vin && (
                      <span className="mr-3 font-mono">
                        VIN {highlight(v.vin, tokens)}
                      </span>
                    )}
                    {v.customer && (
                      <span>
                        Owner: {fullName(v.customer)}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hasRepairOrders && repairOrders.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={`${nouns.plural} (${repairOrders.length})`} />
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {repairOrders.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/repair-orders/${r.id}`}
                  className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {accountType === "AUTO_SHOP" ? "RO " : ""}#{r.roNumber} ·{" "}
                      {fullName(r.customer)} ·{" "}
                      {vehicleLabel(r.vehicle)}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {r.status.replace("_", " ")} ·{" "}
                      {formatInTimeZone(r.openedAt, timezone, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                  {r.complaint && (
                    <div className="mt-0.5 text-xs text-zinc-600 line-clamp-1 dark:text-zinc-400">
                      {highlight(r.complaint, tokens)}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hasNotes && notes.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={`Knowledge notes (${notes.length})`} />
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {notes.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/notes/${n.id}`}
                  className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {highlight(n.title, tokens)}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {[n.make, n.model, n.engine].filter(Boolean).join(" ")}
                    {n.tags && <span className="ml-2">· {n.tags}</span>}
                  </div>
                  {n.symptom && (
                    <div className="mt-0.5 text-xs text-zinc-600 line-clamp-1 dark:text-zinc-400">
                      {highlight(n.symptom, tokens)}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hasParts && parts.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={`Parts (${parts.length})`} />
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {parts.map((part) => (
              <li key={part.id}>
                <Link
                  href={`/inventory/${part.id}`}
                  className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {highlight(part.name, tokens)}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {[
                      part.partNumber,
                      part.category,
                      part.location,
                      `${part.qtyOnHand} in stock`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hasAppointments && appointments.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={`Appointments (${appointments.length})`} />
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {appointments.map((appointment) => (
              <li key={appointment.id}>
                <Link
                  href={`/appointments/${appointment.id}`}
                  className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {highlight(appointment.reason, tokens)}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {fullName(appointment.customer)} ·{" "}
                    {formatInTimeZone(appointment.startsAt, timezone, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                  {appointment.notes && (
                    <div className="mt-0.5 text-xs text-zinc-600 line-clamp-1 dark:text-zinc-400">
                      {highlight(appointment.notes, tokens)}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hasSales && sales.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={`Sales (${sales.length})`} />
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {sales.map((sale) => (
              <li key={sale.id}>
                <Link
                  href="/sales"
                  className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {highlight(sale.itemName, tokens)}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {sale.quantity} × {formatMoney(sale.unitPrice)} ·{" "}
                    {formatInTimeZone(sale.soldAt, timezone, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  {(sale.channel || sale.note) && (
                    <div className="mt-0.5 text-xs text-zinc-600 line-clamp-1 dark:text-zinc-400">
                      {[sale.channel, sale.note].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
