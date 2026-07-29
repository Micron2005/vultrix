import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import {
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";
import { createCategory } from "./actions";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const orgId = await requireOrgId();
  const [categories, counts] = await Promise.all([
    db.category.findMany({
      where: { orgId },
      orderBy: { name: "asc" },
    }),
    db.part.groupBy({
      by: ["category"],
      where: { orgId, archived: false, category: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const countByName = new Map<string, number>();
  for (const count of counts) {
    if (count.category) countByName.set(count.category, count._count._all);
  }

  return (
    <>
      <PageHeader
        title="Inventory categories"
        description="Organize your parts into named categories without changing existing inventory data."
        actions={<LinkButton href="/inventory" variant="secondary">← Inventory</LinkButton>}
      />

      <Card className="mb-6">
        <CardHeader title="New category" />
        <form action={createCategory} className="flex flex-wrap items-end gap-3 p-4">
          <Field label="Name" className="min-w-64 flex-1">
            <Input name="name" required placeholder="e.g. Oil filters" />
          </Field>
          <SaveButton>Create category</SaveButton>
        </form>
      </Card>

      {categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Create your first category, then add parts to it from the category page."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const count = countByName.get(category.name) ?? 0;
            return (
              <Card key={category.id} className="transition hover:border-zinc-400">
                <Link
                  href={`/inventory/categories/${category.id}`}
                  className="block p-5"
                >
                  <div className="text-lg font-semibold text-zinc-900">
                    {category.name}
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {count} {count === 1 ? "active part" : "active parts"}
                  </div>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
