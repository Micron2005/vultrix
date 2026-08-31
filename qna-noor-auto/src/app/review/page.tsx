import Link from "next/link";
import {
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { assertCanViewFinancials } from "@/lib/permissions";
import { enabledFeatureSet, repairOrderNouns } from "@/lib/features";
import { getCurrentUser, requireOrgId } from "@/lib/session";
import { orgTimeZone } from "@/lib/orgTimezone";
import {
  goalMetricLabel,
  goalValueLabel,
} from "@/lib/goals";
import {
  latestCompletedWeekStart,
  loadWeeklyReview,
} from "@/lib/weeklyReview";
import { formatInTimeZone, shiftCalendarDay } from "@/lib/timezone";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

function changeLabel(value: number | null): string {
  if (value === null) return "New";
  if (value === 0) return "No change";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function statusLabel(status: string): string {
  return {
    ahead: "Ahead",
    on_pace: "On pace",
    behind: "Behind",
    met: "Met",
  }[status] ?? status;
}

function statusClass(status: string): string {
  return {
    ahead: "bg-green-100 text-green-800 dark:bg-green-100 dark:text-green-800",
    on_pace: "bg-blue-100 text-blue-800 dark:bg-blue-100 dark:text-blue-800",
    behind: "bg-amber-100 text-amber-800 dark:bg-amber-100 dark:text-amber-800",
    met: "bg-emerald-100 text-emerald-800 dark:bg-emerald-100 dark:text-emerald-800",
  }[status] ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-100 dark:text-zinc-700";
}

export default async function WeeklyReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  assertCanViewFinancials(user.role);
  const orgId = await requireOrgId();
  const features = enabledFeatureSet(user);
  if (!features.has("financials")) return null;
  const timezone = await orgTimeZone(orgId);
  const { week } = await searchParams;
  const review = await loadWeeklyReview(orgId, timezone, features.has("invoices"), week);
  const latest = latestCompletedWeekStart(timezone);
  const canGoNext = review.weekStartDay < latest;
  const nouns = repairOrderNouns(user.accountType);

  return (
    <>
      <PageHeader
        title="Weekly review"
        description="A quick look at what happened and what is coming up."
        actions={<LinkButton href="/expenses" variant="secondary">Financials</LinkButton>}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-900">
            {formatInTimeZone(new Date(`${review.weekStartDay}T12:00:00.000Z`), timezone, {
              month: "short",
              day: "numeric",
            })}{" "}
            –{" "}
            {formatInTimeZone(new Date(`${review.weekEndDay}T12:00:00.000Z`), timezone, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">Completed week</p>
        </div>
        <div className="flex gap-2">
          <LinkButton
            href={`/review?week=${shiftCalendarDay(review.weekStartDay, -7)}`}
            variant="secondary"
            size="sm"
          >
            Previous week
          </LinkButton>
          {canGoNext ? (
            <LinkButton
              href={`/review?week=${shiftCalendarDay(review.weekStartDay, 7)}`}
              variant="secondary"
              size="sm"
            >
              Next week
            </LinkButton>
          ) : (
            <span className="inline-flex h-8 items-center rounded-md border border-zinc-200 px-3 text-sm text-zinc-400 dark:border-zinc-200 dark:text-zinc-400">
              Next week
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">Money in</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-900">{formatMoney(review.moneyIn)}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Prior week: {formatMoney(review.previousMoneyIn)} · {changeLabel(review.moneyInChangePct)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">Spending</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-900">{formatMoney(review.spending)}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Prior week: {formatMoney(review.previousSpending)} · {changeLabel(review.spendingChangePct)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">Net</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-900">{formatMoney(review.net)}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Prior week: {formatMoney(review.previousNet)} · {changeLabel(review.netChangePct)}</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top spending categories" />
          {review.topExpenseCategories.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500 dark:text-zinc-500">No spending recorded this week.</p>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-200">
              {review.topExpenseCategories.map((entry) => (
                <div key={entry.category} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-zinc-700 dark:text-zinc-700">{entry.category}</span>
                  <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-900">{formatMoney(entry.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="What is coming up" />
          <div className="p-5">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-900">
              {review.upcomingAppointmentCount} scheduled appointment{review.upcomingAppointmentCount === 1 ? "" : "s"} in the next 7 days
            </p>
            {review.upcomingAppointments.length > 0 && (
              <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-600">
                {review.upcomingAppointments.map((appointment) => (
                  <li key={appointment.id} className="flex justify-between gap-3">
                    <span>{appointment.reason} · {appointment.customerName}</span>
                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-500">
                      {formatInTimeZone(appointment.startsAt, timezone, { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {review.receivables && (
        <Card className="mt-6">
          <CardHeader title="Money still owed" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-500">Open invoices</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-900">{formatMoney(review.receivables.total)}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-500">{review.receivables.count} invoice{review.receivables.count === 1 ? "" : "s"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-500">Overdue (over {review.receivables.minimumOverdueDays} days)</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-900">{formatMoney(review.receivables.overdueAmount)}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-500">{review.receivables.overdueCount} invoice{review.receivables.overdueCount === 1 ? "" : "s"}</p>
            </div>
          </div>
        </Card>
      )}

      {review.completedJobs !== null && (
        <Card className="mt-6">
          <CardHeader title={user.accountType === "AUTO_SHOP" ? "Jobs completed" : `${nouns.plural} completed`} />
          <p className="p-5 text-2xl font-semibold text-zinc-900 dark:text-zinc-900">{review.completedJobs}</p>
        </Card>
      )}

      {review.unitsSold !== null && review.topSellingProducts && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Units sold" />
            <p className="p-5 text-2xl font-semibold text-zinc-900 dark:text-zinc-900">{review.unitsSold}</p>
          </Card>
          <Card>
            <CardHeader title="Top products" />
            {review.topSellingProducts.length === 0 ? (
              <p className="p-5 text-sm text-zinc-500 dark:text-zinc-500">No products sold this week.</p>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-200">
                {review.topSellingProducts.map((product) => (
                  <div key={product.itemName} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="text-zinc-700 dark:text-zinc-700">{product.itemName} · {product.units} sold</span>
                    <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-900">{formatMoney(product.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Goals" />
          {review.activeGoals.length === 0 ? (
            <EmptyState title="No active goals" description="Create a goal to keep an eye on progress." />
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-200">
              {review.activeGoals.map(({ goal, progress }) => (
                <div key={goal.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link href={`/goals/${goal.id}/edit`} className="font-medium text-zinc-900 dark:text-zinc-900 hover:underline">{goal.title}</Link>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500">{goalMetricLabel(goal.metric, user.accountType, features.has("invoices"))} · {goalValueLabel(goal.metric, progress.actual)} of {goalValueLabel(goal.metric, progress.target)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${statusClass(progress.status)}`}>
                    {statusLabel(progress.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Needs attention" />
          <div className="space-y-3 p-5 text-sm text-zinc-600 dark:text-zinc-600">
            <p>{review.behindGoals} goal{review.behindGoals === 1 ? "" : "s"} behind.</p>
            <p>{review.awaitingConfirmation} recurring item{review.awaitingConfirmation === 1 ? "" : "s"} waiting for confirmation.</p>
          </div>
        </Card>
      </div>
    </>
  );
}
