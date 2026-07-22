import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Button, Card, PageHeader } from "@/components/ui";
import { IncomeForm } from "../../../IncomeForm";
import { deleteIncome, updateIncome } from "../../../income-actions";
import { enabledFeatureSet } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function EditIncomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const features = enabledFeatureSet(user);
  if (!user.orgId || !features.has("financials") || features.has("invoices")) {
    notFound();
  }
  const orgId = user.orgId;
  const income = await db.income.findFirst({ where: { id, orgId } });
  if (!income) notFound();

  const update = updateIncome.bind(null, income.id);
  const remove = deleteIncome.bind(null, income.id);

  return (
    <>
      <PageHeader
        title="Edit income"
        actions={
          <form action={remove}>
            <Button type="submit" variant="danger">
              Delete
            </Button>
          </form>
        }
      />
      <Card className="p-6">
        <IncomeForm
          action={update}
          initial={{
            amount: income.amount,
            receivedAt: income.receivedAt,
            source: income.source,
            frequency: income.frequency,
            note: income.note,
          }}
        />
      </Card>
    </>
  );
}
