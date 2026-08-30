import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { enabledFeatureSet } from "@/lib/features";
import { requireOrgId, requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { RecurringForm } from "../../../RecurringForm";
import { updateRecurring } from "../../../recurring-actions";

export const dynamic = "force-dynamic";

export default async function EditRecurringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await requireOrgId();
  const user = await requireUser();
  const series = await db.recurringEntry.findFirst({ where: { id, orgId } });
  if (!series) notFound();
  if (
    series.kind === "INCOME" &&
    (!enabledFeatureSet(user).has("financials") ||
      enabledFeatureSet(user).has("invoices"))
  ) {
    notFound();
  }
  return (
    <>
      <PageHeader title={`Edit repeating ${series.kind.toLowerCase()}`} />
      <Card className="p-6">
        <RecurringForm
          action={updateRecurring.bind(null, series.id)}
          kind={series.kind === "INCOME" ? "INCOME" : "EXPENSE"}
          accountType={user.accountType}
          initial={series}
        />
      </Card>
    </>
  );
}
