import { LinkButton, PageHeader } from "@/components/ui";
import { NoteForm } from "../NoteForm";
import { createNote } from "../actions";

export default function NewNotePage() {
  return (
    <>
      <PageHeader
        title="New note"
        description="Capture a repair so you (and your future techs) can find it again"
        actions={
          <LinkButton href="/notes" variant="secondary">
            Cancel
          </LinkButton>
        }
      />
      <div className="max-w-3xl">
        <NoteForm action={createNote} submitLabel="Create note" />
      </div>
    </>
  );
}
