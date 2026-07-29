import { LinkButton, PageHeader } from "@/components/ui";
import { NoteForm } from "../NoteForm";
import { createNote } from "../actions";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function NewNotePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const user = await requireUser();
  if (!user.orgId) redirect("/admin");
  const isAutoShop = user.accountType === "AUTO_SHOP";
  const { category: initialCategory } = await searchParams;
  const categories = await db.repairNote.findMany({
    where: { orgId: user.orgId, category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
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
          categories={categories.flatMap((item) => item.category ? [item.category] : [])}
          note={initialCategory ? { category: initialCategory } : undefined}
        />
      </div>
    </>
  );
}
