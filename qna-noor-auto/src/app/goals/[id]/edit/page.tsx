import { notFound, redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { enabledFeatureSet } from "@/lib/features";
import { assertCanViewFinancials } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { isValidTimeZone, localCalendarDay } from "@/lib/timezone";
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
  const organization = await db.organization.findUnique({
    where: { id: user.orgId },
    select: { timezone: true },
  });
  const timezone =
    organization && isValidTimeZone(organization.timezone)
      ? organization.timezone
      : "America/New_York";
  return (
    <>
      <PageHeader title={`Edit ${goal.title}`} />
      <Card className="max-w-3xl p-6">
        <GoalForm
          action={updateGoal.bind(null, goal.id)}
          submitLabel="Save goal"
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
