import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";
import { canDelete } from "@/lib/permissions";
import {
  Card,
  CardHeader,
  Field,
  Input,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";
import {
  deleteCategory,
  renameCategory,
} from "../actions";
import { DeleteCategoryButton } from "../DeleteCategoryButton";

export const dynamic = "force-dynamic";

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await requireOrgId();
  const user = await requireUser();
  const category = await db.category.findFirst({
    where: { id, orgId },
  });
  if (!category) redirect("/inventory/categories");

  const parts = await db.part.findMany({
    where: { orgId, category: category.name, archived: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      partNumber: true,
      qtyOnHand: true,
      unit: true,
      reorderLevel: true,
      location: true,
    },
  });

  const boundRename = renameCategory.bind(null, category.id);
  const boundDelete = deleteCategory.bind(null, category.id);

  return (
    <>
      <PageHeader
        title={category.name}
        description={`${parts.length} ${parts.length === 1 ? "active part" : "active parts"} in this category`}
        actions={
          <div className="flex gap-2">
            <LinkButton href="/inventory/categories" variant="secondary">
              ← Categories
            </LinkButton>
            <LinkButton
              href={`/inventory/new?category=${encodeURIComponent(category.name)}`}
            >
              Add part
            </LinkButton>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader title="Rename category" />
        <form action={boundRename} className="flex flex-wrap items-end gap-3 p-4">
          <Field label="Name" className="min-w-64 flex-1">
            <Input name="name" required defaultValue={category.name} />
          </Field>
          <SaveButton>Save name</SaveButton>
        </form>
      </Card>

      <Card className="mb-6">
        <CardHeader title={`Parts (${parts.length})`} />
        {parts.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            No active parts in this category yet.{" "}
            <Link
              href={`/inventory/new?category=${encodeURIComponent(category.name)}`}
              className="text-indigo-700 hover:underline"
            >
              Add the first part
            </Link>
            .
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Part</th>
                  <th className="px-4 py-2 font-medium">Part #</th>
                  <th className="px-4 py-2 font-medium">Location</th>
                  <th className="px-4 py-2 text-right font-medium">On hand</th>
                  <th className="px-4 py-2 text-right font-medium">Reorder @</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {parts.map((part) => (
                  <tr key={part.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/inventory/${part.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {part.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-600">
                      {part.partNumber ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-600">
                      {part.location ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {part.qtyOnHand}
                      {part.unit && (
                        <span className="ml-1 text-xs font-normal text-zinc-400">
                          {part.unit}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
                      {part.reorderLevel}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/inventory/${part.id}/edit`}
                        className="text-indigo-700 hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="border-red-200">
        <CardHeader title="Danger zone" />
        <div className="flex flex-wrap items-center gap-4 p-4">
          {canDelete(user.role) && <DeleteCategoryButton action={boundDelete} />}
          <span className="text-xs text-zinc-500">
            Parts are kept and become uncategorized.
          </span>
        </div>
      </Card>
    </>
  );
}
