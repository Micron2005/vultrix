import {
  Card,
  CardHeader,
  Field,
  Input,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { PartForm } from "../PartForm";
import { createPart } from "../actions";
import { chooseCategoryForNewPart } from "../categories/actions";

export const dynamic = "force-dynamic";

export default async function NewPartPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; uncategorized?: string }>;
}) {
  const orgId = await requireOrgId();
  const sp = await searchParams;
  const defaultCategory = (sp.category ?? "").trim();
  const uncategorized = sp.uncategorized === "1";

  if (!defaultCategory && !uncategorized) {
    const categories = await db.category.findMany({
      where: { orgId },
      orderBy: { name: "asc" },
      select: { name: true },
    });

    return (
      <>
        <PageHeader
          title="Add part"
          description="Choose where this part belongs before entering its details."
          actions={<LinkButton href="/inventory" variant="secondary">← Inventory</LinkButton>}
        />
        <Card className="max-w-2xl">
          <CardHeader title="Choose a category" />
          <form action={chooseCategoryForNewPart} className="space-y-5 p-4">
            <Field label="Existing category">
              <select
                name="existing"
                defaultValue=""
                className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.name} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="…or create a new category">
              <Input
                name="fresh"
                placeholder="e.g. Oil filters"
                autoComplete="off"
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <SaveButton>Continue</SaveButton>
              <LinkButton href="/inventory/new?uncategorized=1" variant="ghost">
                Skip — add without a category
              </LinkButton>
            </div>
          </form>
        </Card>
      </>
    );
  }

  const [cats, locs] = await Promise.all([
    db.part.findMany({
      where: { orgId, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
    db.part.findMany({
      where: { orgId, location: { not: null } },
      select: { location: true },
      distinct: ["location"],
      orderBy: { location: "asc" },
    }),
  ]);
  const categories = cats
    .map((c) => c.category)
    .filter((c): c is string => Boolean(c));
  const locations = locs
    .map((l) => l.location)
    .filter((l): l is string => Boolean(l));

  return (
    <>
      <PageHeader
        title="Add part"
        description="Add a part you stock so you can track qty on hand and auto-deduct from ROs."
        actions={
          <LinkButton href="/inventory/new" variant="secondary">
            ‹ Change category
          </LinkButton>
        }
      />
      <PartForm
        action={createPart}
        categories={categories}
        locations={locations}
        defaultCategory={defaultCategory}
        submitLabel="Create part"
        isNew
      />
    </>
  );
}
