import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { PartForm } from "../PartForm";
import { createPart } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewPartPage() {
  const orgId = await requireOrgId();
  const cats = await db.part.findMany({
    where: { orgId, category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  const categories = cats
    .map((c) => c.category)
    .filter((c): c is string => Boolean(c));

  return (
    <>
      <PageHeader
        title="Add part"
        description="Add a part you stock so you can track qty on hand and auto-deduct from ROs."
      />
      <PartForm
        action={createPart}
        categories={categories}
        submitLabel="Create part"
        isNew
      />
    </>
  );
}
