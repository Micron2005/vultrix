import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  Card,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { deleteNote } from "../actions";

export const dynamic = "force-dynamic";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!user.orgId) redirect("/admin");
  const orgId = user.orgId;
  const isAutoShop = user.accountType === "AUTO_SHOP";
  const note = await db.repairNote.findFirst({ where: { id, orgId } });
  if (!note) notFound();

  const del = deleteNote.bind(null, note.id);

  return (
    <>
      <PageHeader
        title={note.title}
        description={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600">
            {isAutoShop && <span>{formatVehicleSpec(note)}</span>}
            {isAutoShop && note.laborHoursEstimate != null && (
              <span className="text-xs text-zinc-500">
                · ~{note.laborHoursEstimate.toFixed(1)} hr labor
              </span>
            )}
            <span className="text-xs text-zinc-400">
              {isAutoShop ? "· " : ""}
              updated {formatDateTime(note.updatedAt)}
            </span>
          </div>
        }
        actions={
          <>
            <LinkButton href="/notes" variant="secondary">
              Back
            </LinkButton>
            <LinkButton href={`/notes/${note.id}/edit`}>Edit</LinkButton>
          </>
        }
      />

      {note.tags && (
        <div className="mb-4 flex flex-wrap gap-1 text-xs">
          {note.tags.split(",").map((t) => (
            <Link
              key={t}
              href={`/notes?tag=${encodeURIComponent(t)}`}
              className="rounded-full bg-zinc-100 text-zinc-700 px-2 py-1 hover:bg-zinc-200"
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {isAutoShop ? (
          <>
            <Section title="Symptom / Complaint" body={note.symptom} />
            <Section title="Diagnosis / Cause" body={note.diagnosis} />
            <Section title="Fix / Correction" body={note.fix} />
            <Section title="Parts used / suggested" body={note.partsNotes} />
          </>
        ) : (
          <Section title="Note" body={note.fix} />
        )}
      </div>

      <form action={del} className="mt-8">
        <button
          type="submit"
          className="text-xs text-red-700 hover:underline"
          formNoValidate
        >
          Delete this note
        </button>
      </form>
    </>
  );
}

function Section({
  title,
  body,
}: {
  title: string;
  body: string | null;
}) {
  if (!body) return null;
  return (
    <Card className="p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
        {title}
      </div>
      <div className="whitespace-pre-wrap text-sm text-zinc-900">{body}</div>
    </Card>
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
