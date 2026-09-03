import { db } from "@/lib/db";
import { enabledFeatureSet } from "@/lib/features";
import { goalPaceText } from "@/lib/goalStatus";
import {
  goalValueLabel,
  loadActiveGoals,
  type GoalRecord,
} from "@/lib/goals";
import { canViewFinancials } from "@/lib/permissions";
import { getAllSettings } from "@/lib/shop";
import {
  effectiveDueTime,
  loadTodayRoutines,
} from "@/lib/routines";
import { orgTimeZone } from "@/lib/orgTimezone";
import { localCalendarDay } from "@/lib/timezone";
import { sendEmail, escapeHtml } from "@/lib/email";
import type { Role } from "@/lib/session";

export type DigestSendResult = {
  attempted: number;
  sent: number;
  failed: number;
  skippedNoEmail: number;
  skippedEmpty: number;
};

type DigestUser = {
  id: string;
  username: string;
  role: string;
};

type DigestGoal = {
  goal: GoalRecord;
  progress: Awaited<ReturnType<typeof loadActiveGoals>>[number]["progress"];
};

type DigestRoutine = Awaited<ReturnType<typeof loadTodayRoutines>>[number];

function isDuplicateError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function routineHtml(group: DigestRoutine): string {
  const items = group.items
    .filter((item) => item.status !== "done" && item.status !== "skipped")
    .map((item) => {
      const dueTime = effectiveDueTime(group.routine, item);
      return `<li>${escapeHtml(item.label)}${
        dueTime ? ` <span style="color:#71717a">(due ${escapeHtml(dueTime)})</span>` : ""
      }</li>`;
    })
    .join("");
  return `
    <h3 style="margin:16px 0 6px;color:#18181b">${escapeHtml(group.routine.title)}</h3>
    <ul style="margin:0;padding-left:22px">${items}</ul>
  `;
}

function goalHtml({ goal, progress }: DigestGoal): string {
  return `
    <li>
      <strong>${escapeHtml(goal.title)}</strong>:
      ${escapeHtml(goalValueLabel(goal.metric, progress.actual, goal.unit))} of
      ${escapeHtml(goalValueLabel(goal.metric, progress.target, goal.unit))}
      <span style="color:#71717a">(${escapeHtml(goalPaceText(goal, progress))})</span>
    </li>
  `;
}

export async function buildDailyDigest(
  orgId: string,
  timezone: string,
  user: DigestUser,
  today: string,
): Promise<{ html: string; hasContent: boolean }> {
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: { accountType: true, features: true },
  });
  const hasInvoices = enabledFeatureSet(organization ?? {}).has("invoices");
  const [routineGroups, goals] = await Promise.all([
    loadTodayRoutines(orgId, timezone, {
      forUserId: user.role === "STAFF" ? user.id : undefined,
    }),
    canViewFinancials(user.role as Role)
      ? loadActiveGoals(orgId, timezone, hasInvoices)
      : Promise.resolve([]),
  ]);
  const dueRoutines = routineGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.status !== "done" && item.status !== "skipped",
      ),
    }))
    .filter((group) => group.items.length > 0)
    .sort(
      (left, right) =>
        Number(right.routine.kind === "REMINDER") -
        Number(left.routine.kind === "REMINDER"),
    );
  const behindGoals = goals.filter(
    ({ progress }) => progress.status === "behind",
  );
  const hasContent = dueRoutines.length > 0 || behindGoals.length > 0;
  const dueHtml = dueRoutines.map(routineHtml).join("");
  const goalsHtml = behindGoals.map(goalHtml).join("");
  return {
    hasContent,
    html: `
      <h2 style="margin:0 0 6px;color:#18181b">Good morning, ${escapeHtml(user.username)}</h2>
      <p style="color:#71717a;margin:0 0 16px">For ${escapeHtml(today)}</p>
      ${
        dueHtml
          ? `<h3 style="margin:0;color:#18181b">Due today</h3>${dueHtml}`
          : ""
      }
      ${
        goalsHtml
          ? `<h3 style="margin:24px 0 6px;color:#18181b">Falling behind</h3><ul style="margin:0;padding-left:22px">${goalsHtml}</ul>`
          : ""
      }
      <p style="margin-top:20px">
        <a href="${escapeHtml(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/goals`)}">Open your goals</a>
      </p>
    `,
  };
}

export async function sendDailyDigestForOrg(
  orgId: string,
  now = new Date(),
): Promise<DigestSendResult> {
  const result: DigestSendResult = {
    attempted: 0,
    sent: 0,
    failed: 0,
    skippedNoEmail: 0,
    skippedEmpty: 0,
  };
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true, timezone: true },
  });
  if (!organization) return result;
  const settings = await getAllSettings(orgId);
  if (settings.dailyDigestEmailEnabled !== "true") return result;
  const timezone = await orgTimeZone(orgId);
  const today = localCalendarDay(now, timezone);
  const recipients = await db.user.findMany({
    where: {
      orgId,
      isActive: true,
      role: { not: "SUPERADMIN" },
      email: { not: null },
    },
    select: { id: true, username: true, role: true, email: true },
  });

  for (const recipient of recipients) {
    const targetKey = `${today}:${recipient.id}`;
    let log;
    try {
      log = await db.reminderLog.create({
        data: {
          orgId,
          kind: "DAILY_DIGEST",
          targetKey,
          to: recipient.email!,
          status: "FAILED",
          detail: "Daily digest send started.",
        },
        select: { id: true },
      });
    } catch (error: unknown) {
      if (isDuplicateError(error)) continue;
      throw error;
    }

    try {
      const digest = await buildDailyDigest(
        orgId,
        timezone,
        {
          id: recipient.id,
          username: recipient.username,
          role: recipient.role as Role,
        },
        today,
      );
      if (!digest.hasContent) {
        await db.reminderLog.update({
          where: { id: log.id },
          data: { status: "SKIPPED", detail: "Nothing due." },
        });
        result.skippedEmpty += 1;
        continue;
      }
      result.attempted += 1;
      const sent = await sendEmail({
        to: recipient.email!,
        subject: `${organization.name} — today`,
        html: digest.html,
        replyTo: settings.shopEmail || undefined,
      });
      await db.reminderLog.update({
        where: { id: log.id },
        data: {
          status: sent ? "SENT" : "FAILED",
          detail: sent
            ? "Daily digest email sent."
            : "Email sending is not configured or the provider rejected the send.",
        },
      });
      if (sent) result.sent += 1;
      else result.failed += 1;
    } catch (error) {
      console.error("[daily-digest] send failed:", error);
      await db.reminderLog.update({
        where: { id: log.id },
        data: { status: "FAILED", detail: "Daily digest generation failed." },
      });
      result.attempted += 1;
      result.failed += 1;
    }
  }
  return result;
}
