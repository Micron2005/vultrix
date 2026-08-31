import { db } from "@/lib/db";
import { getCustomerContactLists } from "@/lib/customerContacts";
import { loadOpenAR } from "@/lib/ar";
import { getAllSettings } from "@/lib/shop";
import { computeAllVehicleReminders } from "@/lib/serviceReminders";
import { sendEmail, escapeHtml } from "@/lib/email";
import { enabledFeatureSet } from "@/lib/features";
import {
  formatInTimeZone,
  isValidTimeZone,
  localCalendarDay,
  localHour,
} from "@/lib/timezone";

type ReminderKind = "APPOINTMENT" | "INVOICE_PAST_DUE" | "SERVICE_DUE";

type ReminderCounts = {
  attempted: number;
  sent: number;
  failed: number;
  skippedNoEmail: number;
};

type ReminderCustomer = {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  contacts: Array<{
    kind: string;
    value: string;
    label: string | null;
    isPrimary: boolean;
    sortOrder: number;
  }>;
};

const DEFAULT_TIME_ZONE = "America/New_York";

function emptyCounts(): ReminderCounts {
  return { attempted: 0, sent: 0, failed: 0, skippedNoEmail: 0 };
}

function mergeCounts(target: ReminderCounts, source: ReminderCounts): void {
  target.attempted += source.attempted;
  target.sent += source.sent;
  target.failed += source.failed;
  target.skippedNoEmail += source.skippedNoEmail;
}

function parsePositiveSetting(
  settings: Record<string, string>,
  key: string,
  fallback: number,
): number {
  const value = Number(settings[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseSendHour(settings: Record<string, string>): number {
  const value = Number(settings.reminderSendHour);
  return Number.isFinite(value) ? Math.max(0, Math.min(23, value)) : 8;
}

function getEmail(customer: ReminderCustomer): string | null {
  const lists = getCustomerContactLists(customer);
  return lists.emails.find((contact) => contact.isPrimary)?.value ??
    lists.emails[0]?.value ??
    customer.email ??
    null;
}

function displayName(customer: {
  firstName: string;
  lastName: string;
  companyName: string | null;
}): string {
  return customer.companyName || `${customer.firstName} ${customer.lastName}`.trim();
}

function siteOrigin(): string | null {
  const configured =
    process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://vultrix.net";
  try {
    const parsed = new URL(configured);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? configured
      : null;
  } catch {
    return null;
  }
}

function link(path: string): string | null {
  const origin = siteOrigin();
  return origin ? `${origin}${path}` : null;
}

function displayShopName(
  settings: Record<string, string>,
  organizationName: string | null,
): string {
  return settings.shopName || organizationName || "Vultrix";
}

async function writeReminder(
  orgId: string,
  kind: ReminderKind,
  targetKey: string,
  to: string | null,
  subject: string,
  html: string,
  replyTo?: string,
): Promise<ReminderCounts> {
  const counts = emptyCounts();
  let row: { id: string };
  try {
    row = await db.reminderLog.create({
      data: {
        orgId,
        kind,
        targetKey,
        to: to ?? "",
        status: "FAILED",
        detail: "Reminder send started.",
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
      return counts;
    }
    throw error;
  }
  counts.attempted = 1;

  if (!to) {
    await db.reminderLog.update({
      where: { id: row.id },
      data: {
        status: "SKIPPED_NO_EMAIL",
        detail: "Customer has no email address.",
      },
    });
    counts.skippedNoEmail = 1;
    return counts;
  }

  let sent = false;
  try {
    sent = await sendEmail({ to, subject, html, replyTo });
  } catch (error: unknown) {
    await db.reminderLog.update({
      where: { id: row.id },
      data: {
        status: "FAILED",
        detail: error instanceof Error ? error.message : "Email send failed.",
      },
    });
    counts.failed = 1;
    return counts;
  }

  await db.reminderLog.update({
    where: { id: row.id },
    data: {
      status: sent ? "SENT" : "FAILED",
      detail: sent
        ? "Email sent."
        : "Email sending is not configured or the provider rejected the send.",
    },
  });
  if (sent) counts.sent = 1;
  else counts.failed = 1;
  return counts;
}

function appointmentHtml(args: {
  customerName: string;
  when: string;
  reason: string;
  vehicle: string;
  shopName: string;
  shopPhone: string;
  shareLink: string | null;
}): string {
  return `
    <p>Hi ${escapeHtml(args.customerName)},</p>
    <p>This is a reminder that you have an appointment with ${escapeHtml(args.shopName)} on <strong>${escapeHtml(args.when)}</strong>.</p>
    ${args.reason ? `<p>Reason: ${escapeHtml(args.reason)}</p>` : ""}
    ${args.vehicle ? `<p>Vehicle: ${escapeHtml(args.vehicle)}</p>` : ""}
    ${args.shareLink ? `<p><a href="${escapeHtml(args.shareLink)}">View appointment details</a></p>` : ""}
    <p>${args.shopPhone ? `Please call ${escapeHtml(args.shopPhone)} if you need to reschedule.` : "Please reply to this email if you need to reschedule."}</p>
    <p>Thanks,<br>${escapeHtml(args.shopName)}</p>
  `;
}

async function sendAppointmentReminders(
  orgId: string,
  timezone: string,
  settings: Record<string, string>,
  organizationName: string | null,
  now: Date,
): Promise<ReminderCounts> {
  const counts = emptyCounts();
  if (settings.remindAppointmentsEnabled !== "true") return counts;
  const hoursBefore = parsePositiveSetting(
    settings,
    "remindAppointmentsHoursBefore",
    24,
  );
  const appointments = await db.appointment.findMany({
    where: {
      orgId,
      startsAt: { gte: now, lte: new Date(now.getTime() + hoursBefore * 60 * 60 * 1000) },
      status: { in: ["SCHEDULED", "CONFIRMED"] },
    },
    orderBy: { startsAt: "asc" },
    include: {
      customer: {
        include: {
          contacts: {
            orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
          },
        },
      },
      vehicle: true,
    },
  });
  for (const appointment of appointments) {
    const customer = appointment.customer;
    const email = getEmail(customer);
    const customerName = displayName(customer);
    const when = formatInTimeZone(appointment.startsAt, timezone, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const vehicle = appointment.vehicle
      ? [appointment.vehicle.year, appointment.vehicle.make, appointment.vehicle.model]
          .filter(Boolean)
          .join(" ")
      : "";
    const shareLink = appointment.shareToken
      ? link(`/a/${appointment.shareToken}`)
      : null;
    const shopName = displayShopName(settings, organizationName);
    mergeCounts(
      counts,
      await writeReminder(
        orgId,
        "APPOINTMENT",
        appointment.id,
        email,
        `${shopName} — appointment reminder`,
        appointmentHtml({
          customerName,
          when,
          reason: appointment.reason,
          vehicle,
          shopName,
          shopPhone: settings.shopPhone,
          shareLink,
        }),
        settings.shopEmail || undefined,
      ),
    );
  }
  return counts;
}

async function sendPastDueReminders(
  orgId: string,
  timezone: string,
  settings: Record<string, string>,
  organizationName: string | null,
  now: Date,
): Promise<ReminderCounts> {
  const counts = emptyCounts();
  if (settings.remindPastDueEnabled !== "true") return counts;
  const sendHour = parseSendHour(settings);
  if (localHour(now, timezone) !== sendHour) return counts;
  const minimumDays = parsePositiveSetting(settings, "remindPastDueDays", 30);
  const ar = await loadOpenAR(orgId);
  if (ar.invoices.length === 0) return counts;
  const customerIds = [...new Set(ar.invoices.map((invoice) => invoice.customerId))];
  const customers = await db.customer.findMany({
    where: { orgId, id: { in: customerIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      companyName: true,
      email: true,
      phone: true,
      altPhone: true,
      portalToken: true,
      contacts: {
        orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
      },
    },
  });
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const invoicesByCustomer = new Map<
    string,
    typeof ar.invoices
  >();
  for (const invoice of ar.invoices) {
    if (invoice.daysOutstanding < minimumDays) continue;
    const customerInvoices = invoicesByCustomer.get(invoice.customerId) ?? [];
    customerInvoices.push(invoice);
    invoicesByCustomer.set(invoice.customerId, customerInvoices);
  }
  const shopName = displayShopName(settings, organizationName);
  for (const [customerId, invoices] of invoicesByCustomer) {
    const customer = customerById.get(customerId);
    if (!customer) continue;
    const email = getEmail(customer);
    const sortedInvoices = [...invoices].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    const invoiceIds = sortedInvoices.map((invoice) => invoice.id);
    const totalOwed = sortedInvoices.reduce(
      (total, invoice) => total + invoice.balance,
      0,
    );
    const invoiceList = sortedInvoices
      .map(
        (invoice) =>
          `<li>Invoice #${invoice.invoiceNumber}: $${invoice.balance.toFixed(2)} outstanding (${invoice.daysOutstanding} days old)</li>`,
      )
      .join("");
    const portalLink = customer.portalToken
      ? link(`/p/${customer.portalToken}`)
      : null;
    const portalText = portalLink
      ? `<p><a href="${escapeHtml(portalLink)}">View your invoice details</a></p>`
      : "";
    mergeCounts(
      counts,
      await writeReminder(
        orgId,
        "INVOICE_PAST_DUE",
        `${customerId}:${invoiceIds.join(",")}`,
        email,
        `${shopName} — past-due invoices`,
        `
          <p>Hi ${escapeHtml(displayName(customer))},</p>
          <p>You have ${sortedInvoices.length} past-due invoice${sortedInvoices.length === 1 ? "" : "s"} with a combined outstanding balance of <strong>$${totalOwed.toFixed(2)}</strong>.</p>
          <ul>${invoiceList}</ul>
          ${portalText}
          <p>Please contact ${escapeHtml(shopName)}${settings.shopPhone ? ` at ${escapeHtml(settings.shopPhone)}` : ""} with any questions.</p>
          <p>Thanks,<br>${escapeHtml(shopName)}</p>
        `,
        settings.shopEmail || undefined,
      ),
    );
  }
  return counts;
}

async function sendServiceDueReminders(
  orgId: string,
  timezone: string,
  settings: Record<string, string>,
  organizationName: string | null,
  now: Date,
): Promise<ReminderCounts> {
  const counts = emptyCounts();
  if (settings.remindServiceDueEnabled !== "true") return counts;
  const sendHour = parseSendHour(settings);
  if (localHour(now, timezone) !== sendHour) return counts;
  const reminders = await computeAllVehicleReminders(orgId, now);
  const dueItemsByVehicle = new Map<
    string,
    Array<{
      item: (typeof reminders)[number]["items"][number];
      dueMonth: string;
    }>
  >();
  for (const result of reminders) {
    const dueItems = result.items.flatMap((item) => {
      const dueByDate = item.dueByDate;
      if (
        item.interval.everyMonths == null ||
        dueByDate == null ||
        dueByDate > now
      ) {
        return [];
      }
      return [
        {
          item,
          dueMonth: localCalendarDay(dueByDate, timezone).slice(0, 7),
        },
      ];
    });
    if (dueItems.length > 0) {
      dueItemsByVehicle.set(result.vehicle.id, dueItems);
    }
  }
  if (dueItemsByVehicle.size === 0) return counts;
  const vehicles = await db.vehicle.findMany({
    where: { orgId, id: { in: [...dueItemsByVehicle.keys()] } },
    include: {
      customer: {
        include: {
          contacts: {
            orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
          },
        },
      },
    },
  });
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const shopName = displayShopName(settings, organizationName);
  for (const [vehicleId, dueItems] of dueItemsByVehicle) {
    const vehicle = vehicleById.get(vehicleId);
    if (!vehicle) continue;
    const sortedItems = [...dueItems].sort(
      (a, b) =>
        `${a.item.interval.key}@${a.dueMonth}`.localeCompare(
          `${b.item.interval.key}@${b.dueMonth}`,
        ),
    );
    const pairs = sortedItems.map(
      ({ item, dueMonth }) => `${item.interval.key}@${dueMonth}`,
    );
    const targetKey = `${vehicle.id}:${pairs.join(",")}`;
    const email = getEmail(vehicle.customer);
    const vehicleName = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
      .filter(Boolean)
      .join(" ");
    const intervalList = sortedItems
      .map(
        ({ item, dueMonth }) =>
          `<li>${escapeHtml(item.interval.label)} (due ${escapeHtml(dueMonth)})</li>`,
      )
      .join("");
    mergeCounts(
      counts,
      await writeReminder(
        orgId,
        "SERVICE_DUE",
        targetKey,
        email,
        `${shopName} — service due`,
        `
          <p>Hi ${escapeHtml(displayName(vehicle.customer))},</p>
          <p>Our records show that the following service is due for your${vehicleName ? ` ${escapeHtml(vehicleName)}` : " vehicle"}:</p>
          <ul>${intervalList}</ul>
          <p>Please contact ${escapeHtml(shopName)}${settings.shopPhone ? ` at ${escapeHtml(settings.shopPhone)}` : ""} to schedule service.</p>
          <p>Thanks,<br>${escapeHtml(shopName)}</p>
        `,
        settings.shopEmail || undefined,
      ),
    );
  }
  return counts;
}

export async function sendDueRemindersForOrg(
  orgId: string,
  now: Date = new Date(),
): Promise<ReminderCounts> {
  const [organization, settings] = await Promise.all([
    db.organization.findUnique({
      where: { id: orgId },
      select: { timezone: true, accountType: true, features: true, name: true },
    }),
    getAllSettings(orgId),
  ]);
  const timezone =
    organization && isValidTimeZone(organization.timezone)
      ? organization.timezone
      : DEFAULT_TIME_ZONE;
  const features = enabledFeatureSet(organization ?? {});
  const counts = emptyCounts();
  if (features.has("schedule")) {
    mergeCounts(
      counts,
      await sendAppointmentReminders(
        orgId,
        timezone,
        settings,
        organization?.name ?? null,
        now,
      ),
    );
  }
  if (features.has("invoices")) {
    mergeCounts(
      counts,
      await sendPastDueReminders(
        orgId,
        timezone,
        settings,
        organization?.name ?? null,
        now,
      ),
    );
  }
  if (features.has("vehicles")) {
    mergeCounts(
      counts,
      await sendServiceDueReminders(
        orgId,
        timezone,
        settings,
        organization?.name ?? null,
        now,
      ),
    );
  }
  return counts;
}
