import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { PartForm } from "../../PartForm";
import { updatePart } from "../../actions";

export default async function EditPartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await requireOrgId();
  const part = await db.part.findFirst({ where: { id, orgId } });
  if (!part) notFound();

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

  const boundUpdate = updatePart.bind(null, id);

  return (
    <>
      <PageHeader title={`Edit ${part.name}`} />
      <PartForm
        action={boundUpdate}
        part={part}
        categories={categories}
        locations={locations}
        submitLabel="Save changes"
      />
    </>
  );
}
