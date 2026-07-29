import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";
import { LinkButton, PageHeader } from "@/components/ui";
import { NoteForm } from "../../NoteForm";
import { updateNote } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await requireOrgId();
  const user = await requireUser();
  const note = await db.repairNote.findFirst({
    where: { id, orgId },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  if (!note) notFound();
  const categories = await db.repairNote.findMany({
    where: { orgId, category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });

  const action = updateNote.bind(null, note.id);

  return (
    <>
      <PageHeader
        title="Edit note"
        actions={
          <LinkButton href={`/notes/${note.id}`} variant="secondary">
            Cancel
          </LinkButton>
        }
      />
      <div className="max-w-3xl">
        <NoteForm
          action={action}
          accountType={user.accountType}
          note={note}
          submitLabel="Save changes"
          categories={categories.flatMap((item) => item.category ? [item.category] : [])}
          initialImages={note.images.map((image) => ({ dataUrl: image.dataUrl, caption: image.caption }))}
        />
      </div>
    </>
  );
}
