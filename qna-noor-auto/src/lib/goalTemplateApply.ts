import "server-only";

import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { orgTimeZone } from "@/lib/orgTimezone";
import type { CurrentUser } from "@/lib/session";
import type { GoalTemplate } from "@/lib/goalTemplates";
import { dateInputInTimeZone, localCalendarDay } from "@/lib/timezone";

export async function applyTemplateForOrg({
  orgId,
  user,
  template,
}: {
  orgId: string;
  user: CurrentUser;
  template: GoalTemplate;
}): Promise<{ kind: "goal" | "routine"; id: string }> {
  const timezone = await orgTimeZone(orgId);
  const today = localCalendarDay(new Date(), timezone);
  const startDate = dateInputInTimeZone(today, timezone, new Date(Number.NaN));
  if (Number.isNaN(startDate.getTime())) throw new Error("Date is invalid.");

  if (template.goal) {
    const goal = await db.goal.create({
      data: {
        orgId,
        title: template.title,
        metric: template.goal.metric,
        period: template.goal.period,
        target: template.goal.target,
        category: null,
        startDate,
        dueDate: null,
        manualProgress: null,
        direction: template.goal.direction ?? "AT_LEAST",
        unit: template.goal.unit ?? null,
        notes: null,
      },
    });
    await logActivity({
      orgId,
      user,
      action: "goal.create",
      entity: "Goal",
      entityId: goal.id,
      summary: `Goal created: ${goal.title}`,
    });
    return { kind: "goal", id: goal.id };
  }

  if (template.routine) {
    const routine = await db.routine.create({
      data: {
        orgId,
        title: template.title,
        kind: template.routine.kind,
        weekdays: template.routine.weekdays ?? null,
        day: null,
        dueTime: template.routine.dueTime ?? null,
        endDay: null,
        showStreak: template.routine.showStreak ?? false,
        goalId: null,
        items: {
          create: template.routine.items.map((label, position) => ({
            orgId,
            label,
            position,
          })),
        },
      },
    });
    await logActivity({
      orgId,
      user,
      action: "routine.create",
      entity: "Routine",
      entityId: routine.id,
      summary: `Routine created: ${routine.title}`,
    });
    return { kind: "routine", id: routine.id };
  }

  throw new Error("Starter idea is invalid.");
}
