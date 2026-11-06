import { Card, PageHeader } from "@/components/ui";
import { getCurrentUser, requireOrgId } from "@/lib/session";
import { localCalendarDay } from "@/lib/timezone";
import { orgTimeZone } from "@/lib/orgTimezone";
import { ExpenseForm } from "../ExpenseForm";
import { createExpense } from "../actions";

export default async function NewExpensePage() {
  const user = await getCurrentUser();
  const orgId = await requireOrgId();
  const timeZone = await orgTimeZone(orgId);
  const dateValue = localCalendarDay(new Date(), timeZone);

  return (
    <>
      <PageHeader title="New expense" />
      <Card className="p-6">
        <ExpenseForm
          action={createExpense}
          dateValue={dateValue}
          accountType={user?.accountType}
        />
      </Card>
    </>
  );
}
