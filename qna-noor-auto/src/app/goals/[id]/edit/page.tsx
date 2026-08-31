import { notFound, redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { enabledFeatureSet } from "@/lib/features";
import { assertCanViewFinancials } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { localCalendarDay } from "@/lib/timezone";
import { orgTimeZone } from "@/lib/orgTimezone";
import { db } from "@/lib/db";
import { updateGoal } from "../../actions";
import { GoalForm } from "../../GoalForm";

function dateValue(date: Date | null, timezone: string): string {
  return date ? localCalendarDay(date, timezone) : "";
}

export default async function EditGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertCanViewFinancials(user.role);
  if (!user.orgId || !enabledFeatureSet(user).has("financials")) {
    redirect("/");
  }
  const { id } = await params;
  const goal = await db.goal.findFirst({ where: { id, orgId: user.orgId } });
  if (!goal) notFound();
  const timezone = await orgTimeZone(user.orgId);
  const hasInvoices = enabledFeatureSet(user).has("invoices");
  return (
    <>
      <PageHeader title={`Edit ${goal.title}`} />
      <Card className="max-w-3xl p-6">
        <GoalForm
          action={updateGoal.bind(null, goal.id)}
          submitLabel="Save goal"
          accountType={user.accountType ?? "AUTO_SHOP"}
          hasInvoices={hasInvoices}
          initial={{
            title: goal.title,
            metric: goal.metric,
            target: goal.target,
            period: goal.period,
            category: goal.category,
            startDate: dateValue(goal.startDate, timezone),
            dueDate: dateValue(goal.dueDate, timezone),
            manualProgress: goal.manualProgress,
          }}
        />
      </Card>
    </>
  );
}
