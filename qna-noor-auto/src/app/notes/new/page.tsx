import { LinkButton, PageHeader } from "@/components/ui";
import { NoteForm } from "../NoteForm";
import { createNote } from "../actions";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { IntelTabs } from "../../intel/IntelTabs";
import { noteCategoriesFor } from "@/lib/focusPacks";

export default async function NewNotePage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    year?: string;
    make?: string;
    model?: string;
    engine?: string;
  }>;
}) {
  const user = await requireUser();
  if (!user.orgId) redirect("/admin");
  const isAutoShop = user.accountType === "AUTO_SHOP";
  const {
    category: initialCategory,
    year,
    make,
    model,
    engine,
  } = await searchParams;
  const categories = await db.repairNote.findMany({
    where: { orgId: user.orgId, category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  const categorySuggestions = [
    ...categories.flatMap((item) => item.category ? [item.category] : []),
    ...(user.accountType === "PERSONAL" ? noteCategoriesFor(user.focusPacks) : []),
  ].filter((value, index, values) => values.indexOf(value) === index);
  return (
    <>
      <PageHeader
        title={isAutoShop ? "Vehicle intel" : "New note"}
        description={
          isAutoShop
            ? "Knowledge notes — capture a repair tagged by vehicle."
            : "Capture ideas, details, and useful information so you can find it again"
        }
        actions={
          <LinkButton href="/notes" variant="secondary">
            Cancel
          </LinkButton>
        }
      />
      {isAutoShop && <IntelTabs active="notes" />}
      <div className="max-w-3xl">
        <NoteForm
          action={createNote}
          accountType={user.accountType}
          submitLabel="Create note"
          categories={categorySuggestions}
          note={{
            ...(initialCategory ? { category: initialCategory } : {}),
            ...(year ? { yearMin: Number(year), yearMax: Number(year) } : {}),
            ...(make ? { make } : {}),
            ...(model ? { model } : {}),
            ...(engine ? { engine } : {}),
          }}
        />
      </div>
    </>
  );
}
