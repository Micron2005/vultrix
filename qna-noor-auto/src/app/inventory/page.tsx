import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import {
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { InventoryList, type InventoryPart } from "./InventoryList";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; cat?: string }>;
}) {
  const orgId = await requireOrgId();
  const sp = await searchParams;
  const filter = sp.filter === "low" || sp.filter === "out" || sp.filter === "archived" ? sp.filter : "active";
  const q = (sp.q ?? "").trim();
  const cat = (sp.cat ?? "").trim();

  const where: Record<string, unknown> = { orgId };
  if (filter === "archived") {
    where.archived = true;
  } else {
    where.archived = false;
  }
  if (cat) {
    where.category = cat === "__none__" ? null : cat;
  }
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { partNumber: { contains: q } },
      { source: { contains: q } },
    ];
  }

  let parts = await db.part.findMany({
    where,
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const catRows = await db.part.findMany({
    where: { orgId, archived: false, category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  const allCategories = catRows
    .map((c) => c.category)
    .filter((c): c is string => Boolean(c));
  const locationRows = await db.part.findMany({
    where: { orgId, archived: false, location: { not: null } },
    select: { location: true },
    distinct: ["location"],
    orderBy: { location: "asc" },
  });
  const allLocations = locationRows
    .map((p) => p.location)
    .filter((location): location is string => Boolean(location));
  const unitRows = await db.part.findMany({
    where: { orgId, archived: false, unit: { not: null } },
    select: { unit: true },
    distinct: ["unit"],
    orderBy: { unit: "asc" },
  });
  const allUnits = unitRows
    .map((p) => p.unit)
    .filter((unit): unit is string => Boolean(unit));

  if (filter === "low") {
    parts = parts.filter((p) => p.qtyOnHand <= p.reorderLevel && p.qtyOnHand > 0);
  } else if (filter === "out") {
    parts = parts.filter((p) => p.qtyOnHand <= 0);
  }

  const lowCount = (await db.part.findMany({ where: { orgId, archived: false } })).filter(
    (p) => p.qtyOnHand <= p.reorderLevel,
  ).length;

  const UNCATEGORIZED = "Uncategorized";
  const groupMap = new Map<string, typeof parts>();
  for (const p of parts) {
    const key = p.category ?? UNCATEGORIZED;
    const arr = groupMap.get(key);
    if (arr) arr.push(p);
    else groupMap.set(key, [p]);
  }
  const groups = Array.from(groupMap.entries()).sort(([a], [b]) => {
    if (a === UNCATEGORIZED) return 1;
    if (b === UNCATEGORIZED) return -1;
    return a.localeCompare(b);
  });
  const serializableGroups: [string, InventoryPart[]][] = groups.map(
    ([groupName, groupParts]) => [
      groupName,
      groupParts.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        partNumber: p.partNumber,
        source: p.source,
        location: p.location,
        unit: p.unit,
        category: p.category,
        costPrice: p.costPrice,
        unitPrice: p.unitPrice,
        qtyOnHand: p.qtyOnHand,
        reorderLevel: p.reorderLevel,
      })),
    ],
  );

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Parts you stock. Link these to RO part lines and the stock auto-deducts when used."
        actions={
          <div className="flex gap-2">
            <LinkButton href="/inventory/import" variant="secondary">
              Import parts
            </LinkButton>
            <LinkButton href="/inventory/bin-qr" variant="secondary">
              Shelf / bin QR
            </LinkButton>
            <LinkButton
              href={`/inventory/qr-sheet${filter !== "active" ? `?filter=${filter}` : ""}${q ? `${filter !== "active" ? "&" : "?"}q=${encodeURIComponent(q)}` : ""}`}
              variant="secondary"
            >
              Print QR stickers
            </LinkButton>
            <LinkButton href="/inventory/new">Add part</LinkButton>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <FilterChip label="Active" href="/inventory" active={filter === "active"} />
        <FilterChip
          label={`Low / out (${lowCount})`}
          href="/inventory?filter=low"
          active={filter === "low"}
          highlight={lowCount > 0}
        />
        <FilterChip label="Out of stock" href="/inventory?filter=out" active={filter === "out"} />
        <FilterChip label="Archived" href="/inventory?filter=archived" active={filter === "archived"} />
        <form action="/inventory" method="get" className="ml-auto">
          {filter !== "active" && <input type="hidden" name="filter" value={filter} />}
          {cat && <input type="hidden" name="cat" value={cat} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, part #, supplier…"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>
      </div>

      {allCategories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <span className="text-xs uppercase tracking-wider text-zinc-400 mr-1">
            Category
          </span>
          <FilterChip
            label="All"
            href={catHref(filter, q, "")}
            active={cat === ""}
          />
          {allCategories.map((c) => (
            <FilterChip
              key={c}
              label={c}
              href={catHref(filter, q, c)}
              active={cat === c}
            />
          ))}
          <FilterChip
            label="Uncategorized"
            href={catHref(filter, q, "__none__")}
            active={cat === "__none__"}
          />
        </div>
      )}

      {parts.length === 0 ? (
        <EmptyState
          title={q ? "No matching parts" : "No parts yet"}
          description={
            q
              ? "Try a different search term or clear the filter."
              : "Add parts you keep in stock — oil filters, brake pads, etc. Stock auto-deducts when used on an RO."
          }
          action={<LinkButton href="/inventory/new">Add part</LinkButton>}
        />
      ) : (
        <InventoryList
          groups={serializableGroups}
          allCategories={allCategories}
          allLocations={allLocations}
          allUnits={allUnits}
          partCount={parts.length}
        />
      )}
    </>
  );
}

function catHref(filter: string, q: string, cat: string): string {
  const params = new URLSearchParams();
  if (filter !== "active") params.set("filter", filter);
  if (q) params.set("q", q);
  if (cat) params.set("cat", cat);
  const qs = params.toString();
  return qs ? `/inventory?${qs}` : "/inventory";
}

function FilterChip({
  label,
  href,
  active,
  highlight,
}: {
  label: string;
  href: string;
  active: boolean;
  highlight?: boolean;
}) {
  const base =
    "inline-flex items-center rounded-full px-3 py-1 text-sm border transition-colors";
  if (active) {
    return (
      <span className={`${base} bg-zinc-900 text-white border-zinc-900`}>
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} bg-white hover:bg-zinc-50 ${
        highlight
          ? "border-amber-300 text-amber-800"
          : "border-zinc-300 text-zinc-700"
      }`}
    >
      {label}
    </Link>
  );
}
