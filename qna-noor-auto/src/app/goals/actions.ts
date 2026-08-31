"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { enabledFeatureSet } from "@/lib/features";
import { logActivity } from "@/lib/activity";
import { assertCanViewFinancials } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { dateInputInTimeZone, isValidTimeZone } from "@/lib/timezone";
import { parseDecimal } from "@/lib/utils";
import { GOAL_METRICS, type GoalMetric, type GoalPeriod } from "@/lib/goals";

const GOAL_PERIODS = ["WEEK", "MONTH", "YEAR", "BY_DATE"] as const;

async function requireGoalsContext(): Promise<{
  orgId: string;
  timezone: string;
}> {
  const user = await requireUser();
  assertCanViewFinancials(user.role);
  if (!user.orgId) redirect("/admin");
  const features = enabledFeatureSet(user);
  if (!features.has("financials")) {
    redirect("/");
  }
  const organization = await db.organization.findUnique({
    where: { id: user.orgId },
    select: { timezone: true },
  });
  return {
    orgId: user.orgId,
    timezone:
      organization && isValidTimeZone(organization.timezone)
        ? organization.timezone
        : "America/New_York",
  };
}

function text(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function dateFromForm(fd: FormData, key: string, timezone: string): Date {
  const value = text(fd, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${key === "dueDate" ? "Due date" : "Start date"} is required.`);
  }
  const date = dateInputInTimeZone(value, timezone, new Date(Number.NaN));
  if (Number.isNaN(date.getTime())) {
    throw new Error("Date is invalid.");
  }
  return date;
}

function optionalDateFromForm(
  fd: FormData,
  key: string,
  timezone: string,
): Date | null {
  const value = text(fd, key);
  if (!value) return null;
  return dateInputInTimeZone(value, timezone, new Date(Number.NaN));
}

function goalInput(fd: FormData, timezone: string) {
  const title = text(fd, "title");
  const metric = text(fd, "metric") as GoalMetric;
  const period = text(fd, "period") as GoalPeriod;
  const target = parseDecimal(text(fd, "target"));
  const category = text(fd, "category") || null;
  const startDate = dateFromForm(fd, "startDate", timezone);
  const dueDate = optionalDateFromForm(fd, "dueDate", timezone);
  const manualProgressValue = text(fd, "manualProgress");
  const manualProgress = manualProgressValue
    ? parseDecimal(manualProgressValue)
    : null;

  if (!title) throw new Error("Goal name is required.");
  if (!GOAL_METRICS.includes(metric)) throw new Error("Goal type is invalid.");
  if (!GOAL_PERIODS.includes(period)) throw new Error("Goal period is invalid.");
  if (target == null) throw new Error("Target must be a valid number.");
  if (period === "BY_DATE" && !dueDate) {
    throw new Error("Due date is required for a date goal.");
  }
  if (manualProgressValue && manualProgress == null) {
    throw new Error("Progress must be a valid number.");
  }
  return {
    title,
    metric,
    period,
    target,
    category: metric === "SPENDING" ? category : null,
    startDate,
    dueDate: period === "BY_DATE" ? dueDate : null,
    manualProgress: metric === "MANUAL" ? manualProgress : null,
  };
}

export async function createGoal(fd: FormData) {
  const { orgId, timezone } = await requireGoalsContext();
  const user = await requireUser();
  const input = goalInput(fd, timezone);
  const goal = await db.goal.create({ data: { orgId, ...input } });
  await logActivity({
    orgId,
    user,
    action: "goal.create",
    entity: "Goal",
    entityId: goal.id,
    summary: `Goal created: ${goal.title}`,
  });
  revalidatePath("/goals");
  revalidatePath("/");
  redirect("/goals");
}

export async function updateGoal(id: string, fd: FormData) {
  const { orgId, timezone } = await requireGoalsContext();
  const user = await requireUser();
  const input = goalInput(fd, timezone);
  const goal = await db.goal.updateMany({
    where: { id, orgId },
    data: input,
  });
  if (goal.count === 0) throw new Error("Goal not found.");
  await logActivity({
    orgId,
    user,
    action: "goal.update",
    entity: "Goal",
    entityId: id,
    summary: `Goal updated: ${input.title}`,
  });
  revalidatePath("/goals");
  revalidatePath("/");
  redirect("/goals");
}

export async function archiveGoal(fd: FormData) {
  const { orgId } = await requireGoalsContext();
  const user = await requireUser();
  const id = text(fd, "id");
  if (!id) throw new Error("Goal not found.");
  const goal = await db.goal.updateMany({
    where: { id, orgId },
    data: { archived: true },
  });
  if (goal.count === 0) throw new Error("Goal not found.");
  await logActivity({
    orgId,
    user,
    action: "goal.archive",
    entity: "Goal",
    entityId: id,
    summary: "Goal archived",
  });
  revalidatePath("/goals");
  revalidatePath("/");
  redirect("/goals");
}

export async function restoreGoal(fd: FormData) {
  const { orgId } = await requireGoalsContext();
  const user = await requireUser();
  const id = text(fd, "id");
  if (!id) throw new Error("Goal not found.");
  const goal = await db.goal.updateMany({
    where: { id, orgId },
    data: { archived: false },
  });
  if (goal.count === 0) throw new Error("Goal not found.");
  await logActivity({
    orgId,
    user,
    action: "goal.restore",
    entity: "Goal",
    entityId: id,
    summary: "Goal restored",
  });
  revalidatePath("/goals");
  revalidatePath("/");
  redirect("/goals");
}
