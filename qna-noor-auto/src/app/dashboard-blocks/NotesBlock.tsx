import Link from "next/link";
import { Card, CardHeader, LinkButton } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export async function NotesBlock({
  orgId,
  hasInvoices,
  role,
}: {
  orgId: string;
  hasInvoices: boolean;
  role: string;
}) {
  if (role === "STAFF" || hasInvoices) return null;
  const recentNotes = await db.repairNote.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: { id: true, title: true, updatedAt: true },
  });
  return (
    <Card className="mb-6">
      <CardHeader title="Recent notes">
        <LinkButton href="/notes" variant="ghost" size="sm">
          All notes →
        </LinkButton>
        <LinkButton href="/notes/new" size="sm">
          New note
        </LinkButton>
      </CardHeader>
      {recentNotes.length === 0 ? (
        <div className="p-6 text-center text-sm text-zinc-500">
          No notes yet. Capture something useful for later.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200">
          {recentNotes.map((note) => (
            <li key={note.id}>
              <Link
                href={`/notes/${note.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50"
              >
                <span className="truncate text-sm font-medium text-zinc-900">
                  {note.title}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {formatDate(note.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
