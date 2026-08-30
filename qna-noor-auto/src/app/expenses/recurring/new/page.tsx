import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { enabledFeatureSet } from "@/lib/features";
import { RecurringForm } from "../../RecurringForm";
import { createRecurring } from "../../recurring-actions";

export default async function NewRecurringPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const user = await requireUser();
  const requestedKind = (await searchParams).kind;
  const kind = requestedKind === "INCOME" ? "INCOME" : "EXPENSE";
  if (kind === "INCOME") {
    const features = enabledFeatureSet(user);
    if (!user.orgId || !features.has("financials") || features.has("invoices")) {
      redirect("/expenses");
    }
  }
  return (
    <>
      <PageHeader title={`New repeating ${kind.toLowerCase()}`} />
      <Card className="p-6">
        <RecurringForm action={createRecurring} kind={kind} accountType={user.accountType} />
      </Card>
    </>
  );
}
