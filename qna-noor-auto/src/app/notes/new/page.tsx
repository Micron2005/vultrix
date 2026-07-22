import { LinkButton, PageHeader } from "@/components/ui";
import { NoteForm } from "../NoteForm";
import { createNote } from "../actions";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function NewNotePage() {
  const user = await requireUser();
  if (!user.orgId) redirect("/admin");
  const isAutoShop = user.accountType === "AUTO_SHOP";
  return (
    <>
      <PageHeader
        title="New note"
        description={
          isAutoShop
            ? "Capture a repair so you (and your future techs) can find it again"
            : "Capture ideas, details, and useful information so you can find it again"
        }
        actions={
          <LinkButton href="/notes" variant="secondary">
            Cancel
          </LinkButton>
        }
      />
      <div className="max-w-3xl">
        <NoteForm
          action={createNote}
          accountType={user.accountType}
          submitLabel="Create note"
        />
      </div>
    </>
  );
}
