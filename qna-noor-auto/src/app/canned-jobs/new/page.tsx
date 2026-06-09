import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { CannedJobForm } from "../CannedJobForm";
import { createCannedJob } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCannedJobPage() {
  const orgId = await requireOrgId();
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

  return (
    <>
      <PageHeader title="New preset" />
      <Card className="p-6">
        <CannedJobForm action={createCannedJob} catalog={catalog} />
      </Card>
    </>
  );
}
