import { Card, PageHeader } from "@/components/ui";
import { IncomeForm } from "../../IncomeForm";
import { createIncome } from "../../income-actions";
import { redirect } from "next/navigation";
import { enabledFeatureSet } from "@/lib/features";
import { requireUser } from "@/lib/session";

export default async function NewIncomePage() {
  const user = await requireUser();
  const features = enabledFeatureSet(user);
  if (!user.orgId || !features.has("financials") || features.has("invoices")) {
    redirect("/expenses");
  }
  return (
    <>
      <PageHeader title="New income" />
      <Card className="p-6">
        <IncomeForm action={createIncome} />
      </Card>
    </>
  );
}
