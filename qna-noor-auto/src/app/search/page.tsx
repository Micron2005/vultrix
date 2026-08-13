import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import {
  formatDate,
  fullName,
  vehicleLabel,
} from "@/lib/utils";
import { findNormalizedSearchMatches } from "@/lib/search";

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
      <mark key={idx} className="bg-yellow-200 px-0.5 rounded">
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
  const { q: qRaw } = await searchParams;
  const q = (qRaw ?? "").trim();

  if (!q) {
    return (
      <>
        <PageHeader title="Search" />
        <Card>
          <div className="p-6 text-sm text-zinc-600">
            Type a customer name, phone, VIN, license plate, RO number, or any
            word from a note / complaint into the search bar in the sidebar.
          </div>
        </Card>
      </>
    );
  }

  const tokens = q.split(/\s+/).filter((t) => t.length > 0);
  const { customerIdsByToken, vehicleIdsByToken } =
    await findNormalizedSearchMatches(orgId, tokens);

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

  const [customers, vehicles, repairOrders, notes] = await Promise.all([
    db.customer.findMany({
      where: { orgId, AND: customerAnd },
      orderBy: { lastName: "asc" },
      include: { contacts: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] } },
      take: 20,
    }),
    db.vehicle.findMany({
      where: { orgId, AND: vehicleAnd },
      include: { customer: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    db.repairOrder.findMany({
      where: { orgId, AND: roAnd },
      include: { customer: true, vehicle: true },
      orderBy: { openedAt: "desc" },
      take: 20,
    }),
    db.repairNote.findMany({
      where: { orgId, AND: noteAnd },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  const totalCount =
    customers.length + vehicles.length + repairOrders.length + notes.length;

  return (
    <>
      <PageHeader
        title={`Search: ${q}`}
        description={
          totalCount === 0
            ? "No matches found."
            : `${totalCount} match${totalCount === 1 ? "" : "es"} across customers, vehicles, repair orders, and notes.`
        }
      />

      {totalCount === 0 && (
        <Card>
          <div className="p-6 text-sm text-zinc-600">
            Nothing matched <span className="font-mono">{q}</span>. Try a
            different search term.
          </div>
        </Card>
      )}

      {customers.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={`Customers (${customers.length})`} />
          <ul className="divide-y divide-zinc-200">
            {customers.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/customers/${c.id}`}
                  className="block px-4 py-3 hover:bg-zinc-50"
                >
                  <div className="text-sm font-medium text-zinc-900">
                    {highlight(fullName(c), tokens)}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
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

      {vehicles.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={`Vehicles (${vehicles.length})`} />
          <ul className="divide-y divide-zinc-200">
            {vehicles.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/vehicles/${v.id}`}
                  className="block px-4 py-3 hover:bg-zinc-50"
                >
                  <div className="text-sm font-medium text-zinc-900">
                    {highlight(vehicleLabel(v), tokens)}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
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

      {repairOrders.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={`Repair orders (${repairOrders.length})`} />
          <ul className="divide-y divide-zinc-200">
            {repairOrders.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/repair-orders/${r.id}`}
                  className="block px-4 py-3 hover:bg-zinc-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-zinc-900">
                      RO #{r.roNumber} · {fullName(r.customer)} ·{" "}
                      {vehicleLabel(r.vehicle)}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {r.status.replace("_", " ")} · {formatDate(r.openedAt)}
                    </div>
                  </div>
                  {r.complaint && (
                    <div className="mt-0.5 text-xs text-zinc-600 line-clamp-1">
                      {highlight(r.complaint, tokens)}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {notes.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={`Knowledge notes (${notes.length})`} />
          <ul className="divide-y divide-zinc-200">
            {notes.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/notes/${n.id}`}
                  className="block px-4 py-3 hover:bg-zinc-50"
                >
                  <div className="text-sm font-medium text-zinc-900">
                    {highlight(n.title, tokens)}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {[n.make, n.model, n.engine].filter(Boolean).join(" ")}
                    {n.tags && <span className="ml-2">· {n.tags}</span>}
                  </div>
                  {n.symptom && (
                    <div className="mt-0.5 text-xs text-zinc-600 line-clamp-1">
                      {highlight(n.symptom, tokens)}
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
