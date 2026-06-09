import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import {
  Card,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const orgId = await requireOrgId();
  const { q, tag } = await searchParams;
  const query = q?.trim() ?? "";
  const tagFilter = tag?.trim().toLowerCase() ?? "";

  const where: Record<string, unknown> = { orgId };
  const AND: Record<string, unknown>[] = [];

  if (query) {
    AND.push({
      OR: [
        { title: { contains: query } },
        { make: { contains: query } },
        { model: { contains: query } },
        { engine: { contains: query } },
        { symptom: { contains: query } },
        { diagnosis: { contains: query } },
        { fix: { contains: query } },
        { partsNotes: { contains: query } },
        { tags: { contains: query.toLowerCase() } },
      ],
    });
  }
  if (tagFilter) {
    AND.push({ tags: { contains: tagFilter } });
  }
  if (AND.length > 0) where.AND = AND;

  const notes = await db.repairNote.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  // Collect all unique tags across visible notes for chip filter
  const allTags = new Set<string>();
  for (const n of notes) {
    if (!n.tags) continue;
    for (const t of n.tags.split(",")) {
      const trimmed = t.trim();
      if (trimmed) allTags.add(trimmed);
    }
  }
  const tags = Array.from(allTags).sort();

  return (
    <>
      <PageHeader
        title="Knowledge base"
        description="Your own repair notes, searchable by year, make, model, and text"
        actions={<LinkButton href="/notes/new">New note</LinkButton>}
      />

      <form className="mb-4 max-w-md" method="GET">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Search title, vehicle, symptom, fix, parts…"
        />
        {tagFilter && <input type="hidden" name="tag" value={tagFilter} />}
      </form>

      {tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1 text-xs">
          {tagFilter && (
            <Link
              href={query ? `/notes?q=${encodeURIComponent(query)}` : "/notes"}
              className="rounded-full bg-red-100 text-red-800 px-2 py-1 hover:bg-red-200"
            >
              Clear tag: {tagFilter} ×
            </Link>
          )}
          {!tagFilter &&
            tags.map((t) => (
              <Link
                key={t}
                href={
                  query
                    ? `/notes?q=${encodeURIComponent(query)}&tag=${encodeURIComponent(t)}`
                    : `/notes?tag=${encodeURIComponent(t)}`
                }
                className="rounded-full bg-zinc-100 text-zinc-700 px-2 py-1 hover:bg-zinc-200"
              >
                {t}
              </Link>
            ))}
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState
          title={
            query || tagFilter
              ? "No notes matched your search"
              : "No notes yet"
          }
          description={
            query || tagFilter
              ? undefined
              : "Capture your first repair note so your future self (and future techs) can find it again."
          }
          action={<LinkButton href="/notes/new">Add note</LinkButton>}
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium w-40">Vehicle</th>
                <th className="px-4 py-2 font-medium w-40">Tags</th>
                <th className="px-4 py-2 font-medium w-32">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {notes.map((n) => (
                <tr key={n.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/notes/${n.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {n.title}
                    </Link>
                    {n.symptom && (
                      <div className="text-xs text-zinc-500 line-clamp-1">
                        {n.symptom}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-600">
                    {formatVehicleSpec(n)}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {n.tags ? (
                      <div className="flex flex-wrap gap-1">
                        {n.tags.split(",").map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-zinc-100 text-zinc-700 px-2 py-0.5"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-600">
                    {formatDate(n.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

function formatVehicleSpec(n: {
  yearMin: number | null;
  yearMax: number | null;
  make: string | null;
  model: string | null;
  engine: string | null;
}): string {
  const yr =
    n.yearMin && n.yearMax && n.yearMin !== n.yearMax
      ? `${n.yearMin}–${n.yearMax}`
      : n.yearMin
        ? String(n.yearMin)
        : n.yearMax
          ? String(n.yearMax)
          : "";
  const parts = [yr, n.make, n.model].filter(Boolean);
  if (parts.length === 0) return "Any vehicle";
  const base = parts.join(" ");
  return n.engine ? `${base} · ${n.engine}` : base;
}
