import { Card, PageHeader } from "@/components/ui";
import { IncomeForm } from "../../IncomeForm";
import { createIncome } from "../../income-actions";
import { redirect } from "next/navigation";
import { enabledFeatureSet } from "@/lib/features";
import { requireUser } from "@/lib/session";
import { localCalendarDay } from "@/lib/timezone";
import { orgTimeZone } from "@/lib/orgTimezone";

export default async function NewIncomePage() {
  const user = await requireUser();
  const features = enabledFeatureSet(user);
  if (!user.orgId || !features.has("financials") || features.has("invoices")) {
    redirect("/expenses");
  }
  const timeZone = await orgTimeZone(user.orgId);
  const dateValue = localCalendarDay(new Date(), timeZone);
  return (
    <>
      <PageHeader title="New income" />
      <Card className="p-6">
        <IncomeForm action={createIncome} dateValue={dateValue} />
      </Card>
    </>
  );
}
