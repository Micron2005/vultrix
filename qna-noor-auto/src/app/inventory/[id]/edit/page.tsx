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

  const boundUpdate = updatePart.bind(null, id);

  return (
    <>
      <PageHeader title={`Edit ${part.name}`} />
      <PartForm action={boundUpdate} part={part} submitLabel="Save changes" />
    </>
  );
}
