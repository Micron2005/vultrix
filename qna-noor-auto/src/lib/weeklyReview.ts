import { db } from "@/lib/db";
import { loadOpenAR } from "@/lib/ar";
import {
  loadExpenseCategoryTotals,
  loadExpenseTotal,
  loadMoneyInTotal,
} from "@/lib/financialMetrics";
import { loadActiveGoals } from "@/lib/goals";
import { enabledFeatureSet } from "@/lib/features";
import { getDueConfirmOccurrences } from "@/lib/recurring";
import { getDueInvoiceOccurrences } from "@/lib/recurringInvoices";
import { loadTopSellingProducts } from "@/lib/sales";
import {
  dateInputInTimeZone,
  isDateInput,
  localCalendarDay,
  shiftCalendarDay,
} from "@/lib/timezone";
import { formatMoney, fullName } from "@/lib/utils";
import { getAllSettings } from "@/lib/shop";
import { sendEmail, escapeHtml } from "@/lib/email";
import { orgTimeZone } from "@/lib/orgTimezone";

export type WeeklyReview = {
  weekStartDay: string;
  weekEndDay: string;
  previousWeekStartDay: string;
  previousWeekEndDay: string;
  moneyIn: number;
  spending: number;
  net: number;
  previousMoneyIn: number;
  previousSpending: number;
  previousNet: number;
  moneyInChangePct: number | null;
  spendingChangePct: number | null;
  netChangePct: number | null;
  topExpenseCategories: Array<{ category: string; amount: number }>;
  receivables: {
    total: number;
    count: number;
    overdueAmount: number;
    overdueCount: number;
  } | null;
  completedJobs: number | null;
  unitsSold: number | null;
  topSellingProducts: Array<{
    itemName: string;
    units: number;
    revenue: number;
  }> | null;
  upcomingAppointments: Array<{
    id: string;
    startsAt: Date;
    reason: string;
    customerName: string;
  }>;
  upcomingAppointmentCount: number;
  activeGoals: Awaited<ReturnType<typeof loadActiveGoals>>;
  behindGoals: number;
  awaitingConfirmation: number;
};

export type WeeklyReviewSendResult = {
  attempted: number;
  sent: number;
  failed: number;
  skippedNoEmail: number;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return round(((current - previous) / Math.abs(previous)) * 100);
}

function parseDay(value: string, timezone: string): Date {
  return dateInputInTimeZone(value, timezone, new Date(Number.NaN));
}

function endOfDay(value: string, timezone: string): Date {
  return new Date(parseDay(shiftCalendarDay(value, 1), timezone).getTime() - 1);
}

function mondayOffset(day: string): number {
  const sundayBased = new Date(`${day}T12:00:00.000Z`).getUTCDay();
  return (sundayBased + 6) % 7;
}

function isMonday(value: string): boolean {
  return mondayOffset(value) === 0;
}

export function latestCompletedWeekStart(
  timezone: string,
  now = new Date(),
): string {
  const today = localCalendarDay(now, timezone);
  const currentMonday = shiftCalendarDay(today, -mondayOffset(today));
  return shiftCalendarDay(currentMonday, -7);
}

function resolveWeekStart(
  timezone: string,
  requested: string | undefined,
  now: Date,
): string {
  if (requested !== undefined) {
    if (!isDateInput(requested) || !isMonday(requested)) {
      throw new Error("Week must be a Monday in YYYY-MM-DD format.");
    }
    return requested;
  }
  return latestCompletedWeekStart(timezone, now);
}

function financialRange(
  startDay: string,
  timezone: string,
): { from: Date; to: Date } {
  return {
    from: parseDay(startDay, timezone),
    to: endOfDay(shiftCalendarDay(startDay, 6), timezone),
  };
}

function appointmentName(customer: {
  firstName: string;
  lastName: string;
  companyName: string | null;
}): string {
  return fullName(customer);
}

export async function loadWeeklyReview(
  orgId: string,
  timezone: string,
  hasInvoices: boolean,
  weekStartDay?: string,
  now = new Date(),
): Promise<WeeklyReview> {
  const startDay = resolveWeekStart(timezone, weekStartDay, now);
  const endDay = shiftCalendarDay(startDay, 6);
  const previousStartDay = shiftCalendarDay(startDay, -7);
  const previousEndDay = shiftCalendarDay(startDay, -1);
  const range = financialRange(startDay, timezone);
  const previousRange = financialRange(previousStartDay, timezone);
  const upcomingStart = parseDay(localCalendarDay(now, timezone), timezone);
  const upcomingEnd = new Date(
    parseDay(shiftCalendarDay(localCalendarDay(now, timezone), 7), timezone).getTime() -
      1,
  );
  const [
    moneyIn,
    spending,
    previousMoneyIn,
    previousSpending,
    topExpenseCategories,
    activeGoals,
    upcomingAppointmentCount,
    upcomingAppointments,
    recurringDue,
    recurringInvoiceDue,
  ] = await Promise.all([
    loadMoneyInTotal(orgId, range, hasInvoices),
    loadExpenseTotal(orgId, range),
    loadMoneyInTotal(orgId, previousRange, hasInvoices),
    loadExpenseTotal(orgId, previousRange),
    loadExpenseCategoryTotals(orgId, range),
    loadActiveGoals(orgId, timezone, hasInvoices),
    db.appointment.count({
      where: {
        orgId,
        startsAt: { gte: upcomingStart, lte: upcomingEnd },
        status: { in: ["SCHEDULED", "CONFIRMED"] },
      },
    }),
    db.appointment.findMany({
      where: {
        orgId,
        startsAt: { gte: upcomingStart, lte: upcomingEnd },
        status: { in: ["SCHEDULED", "CONFIRMED"] },
      },
      select: {
        id: true,
        startsAt: true,
        reason: true,
        customer: {
          select: { firstName: true, lastName: true, companyName: true },
        },
      },
      orderBy: { startsAt: "asc" },
      take: 10,
    }),
    getDueConfirmOccurrences(orgId, now),
    getDueInvoiceOccurrences(orgId, now),
  ]);
  const completedJobs = hasInvoices
    ? await db.repairOrder.count({
        where: {
          orgId,
          deletedAt: null,
          completedAt: { gte: range.from, lte: range.to },
        },
      })
    : null;
  const receivables = hasInvoices ? await loadOpenAR(orgId) : null;
  const topSellingProducts = hasInvoices
    ? null
    : await loadTopSellingProducts(orgId, range);
  const unitsSold = hasInvoices
    ? null
    : await db.sale.aggregate({
        where: { orgId, soldAt: { gte: range.from, lte: range.to } },
        _sum: { quantity: true },
      });
  const net = moneyIn - spending;
  const previousNet = previousMoneyIn - previousSpending;
  const overdue = receivables?.invoices.filter(
    (invoice) => invoice.daysOutstanding > 0,
  );
  const reviewGoals = activeGoals.filter(
    ({ progress }) => progress.status === "behind",
  ).length;
  const dueCount =
    recurringDue.length + (hasInvoices ? recurringInvoiceDue.length : 0);
  return {
    weekStartDay: startDay,
    weekEndDay: endDay,
    previousWeekStartDay: previousStartDay,
    previousWeekEndDay: previousEndDay,
    moneyIn: round(moneyIn),
    spending: round(spending),
    net: round(net),
    previousMoneyIn: round(previousMoneyIn),
    previousSpending: round(previousSpending),
    previousNet: round(previousNet),
    moneyInChangePct: percentChange(moneyIn, previousMoneyIn),
    spendingChangePct: percentChange(spending, previousSpending),
    netChangePct: percentChange(net, previousNet),
    topExpenseCategories: topExpenseCategories.slice(0, 3).map((entry) => ({
      category: entry.category,
      amount: round(entry.amount),
    })),
    receivables: receivables
      ? {
          total: round(receivables.total),
          count: receivables.invoices.length,
          overdueAmount: round(
            overdue?.reduce((sum, invoice) => sum + invoice.balance, 0) ?? 0,
          ),
          overdueCount: overdue?.length ?? 0,
        }
      : null,
    completedJobs,
    unitsSold: hasInvoices ? null : (unitsSold?._sum.quantity ?? 0),
    topSellingProducts,
    upcomingAppointments: upcomingAppointments.map((appointment) => ({
      id: appointment.id,
      startsAt: appointment.startsAt,
      reason: appointment.reason,
      customerName: appointmentName(appointment.customer),
    })),
    upcomingAppointmentCount,
    activeGoals,
    behindGoals: reviewGoals,
    awaitingConfirmation: dueCount,
  };
}

function emailOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://vultrix.net"
  );
}

function weeklyReviewEmailHtml(
  review: WeeklyReview,
  timezone: string,
  shopName: string,
): string {
  const week = `${review.weekStartDay} – ${review.weekEndDay}`;
  const categories = review.topExpenseCategories
    .map(
      (entry) =>
        `<li>${escapeHtml(entry.category)}: ${escapeHtml(formatMoney(entry.amount))}</li>`,
    )
    .join("");
  return `
    <h2 style="margin:0 0 6px;color:#18181b">Weekly review for ${escapeHtml(shopName)}</h2>
    <p style="color:#52525b;margin:0 0 16px">${escapeHtml(week)}</p>
    <table style="border-collapse:collapse;color:#18181b;font:14px sans-serif">
      <tr><td style="padding:4px 20px 4px 0">Money in</td><td style="padding:4px 0"><strong>${escapeHtml(formatMoney(review.moneyIn))}</strong></td></tr>
      <tr><td style="padding:4px 20px 4px 0">Spending</td><td style="padding:4px 0"><strong>${escapeHtml(formatMoney(review.spending))}</strong></td></tr>
      <tr><td style="padding:4px 20px 4px 0">Net</td><td style="padding:4px 0"><strong>${escapeHtml(formatMoney(review.net))}</strong></td></tr>
    </table>
    ${categories ? `<h3 style="color:#18181b">Top spending categories</h3><ul>${categories}</ul>` : ""}
    <p style="margin-top:20px"><a href="${escapeHtml(`${emailOrigin()}/review?week=${review.weekStartDay}`)}">Open your weekly review</a></p>
    <p style="color:#71717a;font-size:12px">Times and dates use ${escapeHtml(timezone)}.</p>
  `;
}

export async function sendWeeklyReviewForOrg(
  orgId: string,
  now = new Date(),
): Promise<WeeklyReviewSendResult> {
  const result: WeeklyReviewSendResult = {
    attempted: 0,
    sent: 0,
    failed: 0,
    skippedNoEmail: 0,
  };
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      name: true,
      billingEmail: true,
      timezone: true,
      accountType: true,
      features: true,
    },
  });
  if (!organization) return result;
  const timezone = await orgTimeZone(orgId);
  const features = enabledFeatureSet(organization);
  if (!features.has("financials")) return result;
  const today = localCalendarDay(now, timezone);
  if (mondayOffset(today) !== 0) return result;
  const weekStartDay = latestCompletedWeekStart(timezone, now);
  const settings = await getAllSettings(orgId);
  if (settings.weeklyReviewEmailEnabled !== "true") return result;
  const existing = await db.reminderLog.findUnique({
    where: {
      orgId_kind_targetKey: {
        orgId,
        kind: "WEEKLY_REVIEW",
        targetKey: weekStartDay,
      },
    },
    select: { id: true },
  });
  if (existing) return result;
  const owner = await db.user.findFirst({
    where: { orgId, role: "OWNER", isActive: true },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });
  const to = settings.shopEmail || organization.billingEmail || owner?.email || "";
  let log;
  try {
    log = await db.reminderLog.create({
      data: {
        orgId,
        kind: "WEEKLY_REVIEW",
        targetKey: weekStartDay,
        to,
        status: "FAILED",
        detail: "Weekly review send started.",
      },
      select: { id: true },
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return result;
    }
    throw error;
  }
  result.attempted = 1;
  if (!to) {
    await db.reminderLog.update({
      where: { id: log.id },
      data: { status: "SKIPPED_NO_EMAIL", detail: "No review email address configured." },
    });
    result.skippedNoEmail = 1;
    return result;
  }
  const hasInvoices = enabledFeatureSet(organization).has("invoices");
  try {
    const review = await loadWeeklyReview(
      orgId,
      timezone,
      hasInvoices,
      weekStartDay,
      now,
    );
    const sent = await sendEmail({
      to,
      subject: `${organization.name} — weekly review`,
      html: weeklyReviewEmailHtml(review, timezone, organization.name),
      replyTo: settings.shopEmail || undefined,
    });
    await db.reminderLog.update({
      where: { id: log.id },
      data: {
        status: sent ? "SENT" : "FAILED",
        detail: sent
          ? "Weekly review email sent."
          : "Email sending is not configured or the provider rejected the send.",
      },
    });
    if (sent) result.sent = 1;
    else result.failed = 1;
  } catch (error) {
    console.error("[weekly-review] send failed:", error);
    await db.reminderLog.update({
      where: { id: log.id },
      data: { status: "FAILED", detail: "Weekly review generation failed." },
    });
    result.failed = 1;
  }
  return result;
}
