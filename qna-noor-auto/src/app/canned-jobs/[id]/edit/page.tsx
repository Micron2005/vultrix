import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { CannedJobForm } from "../../CannedJobForm";
import { updateCannedJob } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditCannedJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await requireOrgId();
  const job = await db.cannedJob.findFirst({
    where: { id, orgId },
    include: {
      laborItems: { orderBy: { sortOrder: "asc" } },
      partItems: { orderBy: { sortOrder: "asc" } },
      feeItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!job) notFound();

  const catalog = await db.part.findMany({
    where: { orgId, archived: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      partNumber: true,
      unitPrice: true,
      qtyOnHand: true,
    },
  });

  const bound = updateCannedJob.bind(null, job.id);

  return (
    <>
      <PageHeader title={`Edit — ${job.name}`} />
      <Card className="p-6">
        <CannedJobForm
          action={bound}
          catalog={catalog}
          initial={{
            name: job.name,
            description: job.description,
            category: job.category,
            notes: job.notes,
            archived: job.archived,
            laborItems: job.laborItems.map((l) => ({
              description: l.description,
              hours: l.hours,
              rate: l.rate,
            })),
            partItems: job.partItems.map((p) => ({
              partId: p.partId,
              partNumber: p.partNumber,
              description: p.description,
              quantity: p.quantity,
              unitPrice: p.unitPrice,
            })),
            feeItems: job.feeItems.map((f) => ({
              description: f.description,
              amount: f.amount,
            })),
          }}
        />
      </Card>
    </>
  );
}
