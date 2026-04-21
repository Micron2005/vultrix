import { notFound } from "next/navigation";
import { db } from "@/lib/db";
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
  const note = await db.repairNote.findUnique({ where: { id } });
  if (!note) notFound();

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
        <NoteForm action={action} note={note} submitLabel="Save changes" />
      </div>
    </>
  );
}
