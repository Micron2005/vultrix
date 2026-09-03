"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { enabledFeatureSet } from "@/lib/features";
import { metricAllowed } from "@/lib/goalAvailability";
import { logActivity } from "@/lib/activity";
import { assertCanViewFinancials } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import {
  dateInputInTimeZone,
  isDateInput,
  localCalendarDay,
} from "@/lib/timezone";
import { orgTimeZone } from "@/lib/orgTimezone";
import { parseDecimal } from "@/lib/utils";
import {
  GOAL_METRICS,
  type GoalMetric,
  type GoalPeriod,
} from "@/lib/goals";

const GOAL_PERIODS = ["WEEK", "MONTH", "YEAR", "BY_DATE"] as const;

async function requireGoalsContext(): Promise<{
  orgId: string;
  timezone: string;
  accountType: string;
  hasInvoices: boolean;
  features: Set<string>;
}> {
  const user = await requireUser();
  assertCanViewFinancials(user.role);
  if (!user.orgId) redirect("/admin");
  const organization = await db.organization.findUnique({
    where: { id: user.orgId },
    select: { accountType: true, features: true },
  });
  const accountType = organization?.accountType ?? user.accountType ?? "AUTO_SHOP";
  const features = enabledFeatureSet({
    accountType,
    features: organization?.features ?? user.features ?? [],
  });
  return {
    orgId: user.orgId,
    timezone: await orgTimeZone(user.orgId),
    accountType,
    hasInvoices: features.has("invoices"),
    features,
  };
}

function text(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function dateFromForm(fd: FormData, key: string, timezone: string): Date {
  const value = text(fd, key);
  if (!isDateInput(value)) {
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
  if (!isDateInput(value)) throw new Error("Date is invalid.");
  return dateInputInTimeZone(value, timezone, new Date(Number.NaN));
}

function goalInput(
  fd: FormData,
  timezone: string,
  accountType: string,
  features: Set<string>,
) {
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
  const notes = text(fd, "notes") || null;
  const requestedDirection = text(fd, "direction");
  const direction =
    metric === "SPENDING"
      ? "AT_MOST"
      : ["LOGGED_TOTAL", "LOGGED_LATEST"].includes(metric) &&
          requestedDirection === "AT_MOST"
        ? "AT_MOST"
        : "AT_LEAST";
  const unit = text(fd, "unit") || null;

  if (!title) throw new Error("Goal name is required.");
  if (!GOAL_METRICS.includes(metric)) throw new Error("Goal type is invalid.");
  if (!metricAllowed(metric, { accountType, features })) {
    throw new Error("That goal type is not available for this account.");
  }
  if (!GOAL_PERIODS.includes(period)) throw new Error("Goal period is invalid.");
  if (metric === "NET_SAVED" && period !== "BY_DATE") {
    throw new Error("Money saved goals must use a date range.");
  }
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
    direction,
    unit: ["LOGGED_TOTAL", "LOGGED_LATEST", "MANUAL"].includes(metric)
      ? unit
      : null,
    notes,
  };
}

export async function createGoal(fd: FormData) {
  const { orgId, timezone, accountType, features } = await requireGoalsContext();
  const user = await requireUser();
  const input = goalInput(fd, timezone, accountType, features);
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
  const { orgId, timezone, accountType, features } = await requireGoalsContext();
  const user = await requireUser();
  const input = goalInput(fd, timezone, accountType, features);
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
  revalidatePath(`/goals/${id}`);
  revalidatePath("/");
  redirect("/goals");
}

export async function logGoalEntry(fd: FormData) {
  const { orgId, timezone } = await requireGoalsContext();
  const goalId = text(fd, "goalId");
  const value = parseDecimal(text(fd, "value"));
  const day = text(fd, "day") || localCalendarDay(new Date(), timezone);
  const note = text(fd, "note") || null;
  if (!goalId) throw new Error("Goal not found.");
  if (value == null) throw new Error("Value must be a valid number.");
  if (!isDateInput(day)) throw new Error("Date is invalid.");
  const parsedDay = dateInputInTimeZone(day, timezone, new Date(Number.NaN));
  if (
    Number.isNaN(parsedDay.getTime()) ||
    localCalendarDay(parsedDay, timezone) !== day
  ) {
    throw new Error("Date is invalid.");
  }
  const goal = await db.goal.findFirst({
    where: { id: goalId, orgId },
    select: { metric: true },
  });
  if (
    !goal ||
    !["LOGGED_TOTAL", "LOGGED_LATEST"].includes(goal.metric)
  ) {
    throw new Error("Logged-number goal not found.");
  }
  await db.goalEntry.create({ data: { goalId, orgId, day, value, note } });
  revalidatePath("/goals");
  revalidatePath(`/goals/${goalId}`);
  revalidatePath("/");
}

export async function setGoalManualProgress(fd: FormData) {
  const { orgId } = await requireGoalsContext();
  const goalId = text(fd, "goalId");
  const value = parseDecimal(text(fd, "value"));
  if (!goalId) throw new Error("Goal not found.");
  if (value == null) throw new Error("Value must be a valid number.");
  const goal = await db.goal.findFirst({
    where: { id: goalId, orgId },
    select: { metric: true },
  });
  if (!goal || goal.metric !== "MANUAL") {
    throw new Error("Manually updated goal not found.");
  }
  await db.goal.update({
    where: { id: goalId },
    data: { manualProgress: value },
  });
  revalidatePath("/goals");
  revalidatePath(`/goals/${goalId}`);
  revalidatePath("/");
}

export async function deleteGoalEntry(fd: FormData) {
  const { orgId } = await requireGoalsContext();
  const id = text(fd, "id");
  const goalId = text(fd, "goalId");
  if (!id || !goalId) throw new Error("Entry not found.");
  await db.goalEntry.deleteMany({ where: { id, goalId, orgId } });
  revalidatePath("/goals");
  revalidatePath(`/goals/${goalId}`);
  revalidatePath("/");
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

export async function deleteGoal(fd: FormData) {
  const { orgId } = await requireGoalsContext();
  const user = await requireUser();
  const id = text(fd, "id");
  if (!id) throw new Error("Goal not found.");
  const goal = await db.goal.findFirst({
    where: { id, orgId },
    select: { title: true },
  });
  if (!goal) throw new Error("Goal not found.");
  await db.$transaction(async (tx) => {
    await tx.routine.deleteMany({ where: { goalId: id, orgId } });
    await tx.goal.deleteMany({ where: { id, orgId } });
  });
  await logActivity({
    orgId,
    user,
    action: "goal.delete",
    entity: "Goal",
    entityId: id,
    summary: `Goal deleted: ${goal.title}`,
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
