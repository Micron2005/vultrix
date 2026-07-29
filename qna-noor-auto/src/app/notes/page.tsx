import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { EmptyState, Input, LinkButton, PageHeader } from "@/components/ui";
import { NotesList, type NoteGroup } from "./NotesList";

export const dynamic = "force-dynamic";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; cat?: string }>;
}) {
  const user = await requireUser();
  if (!user.orgId) redirect("/admin");
  const { q, tag, cat } = await searchParams;
  const query = q?.trim() ?? "";
  const tagFilter = tag?.trim().toLowerCase() ?? "";
  const categoryFilter = cat?.trim() ?? "";
  const where: Record<string, unknown> = { orgId: user.orgId };
  const AND: Record<string, unknown>[] = [];

  if (query) {
    AND.push({ OR: [
      { title: { contains: query } }, { category: { contains: query } },
      { make: { contains: query } }, { model: { contains: query } },
      { engine: { contains: query } }, { symptom: { contains: query } },
      { diagnosis: { contains: query } }, { fix: { contains: query } },
      { partsNotes: { contains: query } }, { tags: { contains: query.toLowerCase() } },
    ] });
  }
  if (tagFilter) AND.push({ tags: { contains: tagFilter } });
  if (categoryFilter === "__none__") AND.push({ category: null });
  else if (categoryFilter) AND.push({ category: categoryFilter });
  if (AND.length) where.AND = AND;

  const [notes, categoryRows] = await Promise.all([
    db.repairNote.findMany({ where, orderBy: { updatedAt: "desc" }, take: 200 }),
    db.repairNote.findMany({
      where: { orgId: user.orgId, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ]);
  const categories = categoryRows.flatMap((row) => row.category ? [row.category] : []);
  const allTags = new Set<string>();
  for (const note of notes) {
    for (const value of note.tags?.split(",") ?? []) if (value.trim()) allTags.add(value.trim());
  }
  const groupsByName = new Map<string, NoteGroup>();
  for (const note of notes) {
    const name = note.category ?? "Uncategorized";
    const group = groupsByName.get(name) ?? { name, notes: [] };
    group.notes.push({
      id: note.id,
      title: note.title,
      fix: note.fix,
      symptom: note.symptom,
      tags: note.tags,
      updatedAt: note.updatedAt.toISOString(),
      yearMin: note.yearMin,
      yearMax: note.yearMax,
      make: note.make,
      model: note.model,
      engine: note.engine,
    });
    groupsByName.set(name, group);
  }
  const groups = [...groupsByName.values()].sort((a, b) =>
    a.name === "Uncategorized" ? 1 : b.name === "Uncategorized" ? -1 : a.name.localeCompare(b.name));
  const filterHref = (next: Record<string, string | null>) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (tagFilter) params.set("tag", tagFilter);
    if (categoryFilter) params.set("cat", categoryFilter);
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value); else params.delete(key);
    }
    const text = params.toString();
    return text ? `/notes?${text}` : "/notes";
  };
  const isAutoShop = user.accountType === "AUTO_SHOP";
  const hasFilters = Boolean(query || tagFilter || categoryFilter);

  return (
    <>
      <PageHeader
        title="Knowledge base"
        description={isAutoShop ? "Your own repair notes, searchable by year, make, model, and text" : "Your notes, searchable by title, details, and tags"}
        actions={<LinkButton href="/notes/new">New note</LinkButton>}
      />
      <form className="mb-4 max-w-md" method="GET">
        <Input name="q" defaultValue={query} placeholder={isAutoShop ? "Search title, vehicle, symptom, fix, parts…" : "Search title, details, tags…"} />
        {tagFilter && <input type="hidden" name="tag" value={tagFilter} />}
        {categoryFilter && <input type="hidden" name="cat" value={categoryFilter} />}
      </form>
      {(categories.length > 0 || categoryFilter) && (
        <div className="mb-4 flex flex-wrap gap-1 text-xs">
          {categoryFilter && <Link href={filterHref({ cat: null })} className="rounded-full bg-red-100 px-2 py-1 text-red-800 hover:bg-red-200">Clear category ×</Link>}
          {!categoryFilter && categories.map((category) => <Link key={category} href={filterHref({ cat: category })} className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700 hover:bg-zinc-200">{category}</Link>)}
          {!categoryFilter && <Link href={filterHref({ cat: "__none__" })} className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700 hover:bg-zinc-200">Uncategorized</Link>}
        </div>
      )}
      {allTags.size > 0 && (
        <div className="mb-4 flex flex-wrap gap-1 text-xs">
          {tagFilter && <Link href={filterHref({ tag: null })} className="rounded-full bg-red-100 px-2 py-1 text-red-800 hover:bg-red-200">Clear tag: {tagFilter} ×</Link>}
          {!tagFilter && [...allTags].sort().map((value) => <Link key={value} href={filterHref({ tag: value })} className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700 hover:bg-zinc-200">{value}</Link>)}
        </div>
      )}
      {notes.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No notes matched your search" : "No notes yet"}
          description={hasFilters ? undefined : isAutoShop ? "Capture your first repair note so your future self (and future techs) can find it again." : "Capture your first note so you can find it again when you need it."}
          action={<LinkButton href="/notes/new">Add note</LinkButton>}
        />
      ) : <NotesList groups={groups} isAutoShop={isAutoShop} />}
    </>
  );
}
