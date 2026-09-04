import Link from "next/link";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import {
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { fullName, vehicleLabel } from "@/lib/utils";
import { getSetting } from "@/lib/shop";
import { prettyStatus } from "@/app/appointments/AppointmentForm";
import { statusBadgeClass } from "@/app/appointments/status";
import { orgTimeZone } from "@/lib/orgTimezone";
import {
  dateInputInTimeZone,
  formatInTimeZone,
  localCalendarDay,
  shiftCalendarDay,
} from "@/lib/timezone";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ day?: string }>;

// Appointment-reminder page. Lists the next day's scheduled appointments
// (default: "tomorrow") and gives operator-driven Text / Email buttons per
// row — each one opens the phone's SMS / mail app prefilled with a
// confirmation message including date, time, vehicle, and (if generated)
// the customer-facing /a/[token] reminder link.
//
// This is Option A: no Twilio / Resend required. The operator still hits
// Send in their phone/mail app. See /reminders for the dormant-customer
// version.

function formatDayLabel(
  dateValue: string,
  label: string,
  timezone: string,
): string {
  const date = dateInputInTimeZone(dateValue, timezone, new Date(Number.NaN));
  const formatted = formatInTimeZone(date, timezone, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return `${label} · ${formatted}`;
}

function formatTime(d: Date, timezone: string): string {
  return formatInTimeZone(d, timezone, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AppointmentRemindersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const orgId = await requireOrgId();
  const sp = await searchParams;
  const mode = sp.day === "today" ? "today" : sp.day === "week" ? "week" : "tomorrow";
  const timezone = await orgTimeZone(orgId);

  const todayKey = localCalendarDay(new Date(), timezone);
  const rangeStartKey =
    mode === "tomorrow" ? shiftCalendarDay(todayKey, 1) : todayKey;
  const rangeEndKey = shiftCalendarDay(
    rangeStartKey,
    mode === "week" ? 7 : 1,
  );
  const rangeStart = dateInputInTimeZone(
    rangeStartKey,
    timezone,
    new Date(Number.NaN),
  );
  const rangeEnd = dateInputInTimeZone(
    rangeEndKey,
    timezone,
    new Date(Number.NaN),
  );

  // Resolve the origin so the customer-facing /a/<token> links embedded in
  // the SMS / email bodies are full URLs (e.g. https://host/a/abc) rather
  // than bare paths, which most phones won't auto-linkify.
  const hdrs = await headers();
  const forwardedHost = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const forwardedProto =
    hdrs.get("x-forwarded-proto") ?? (forwardedHost.startsWith("localhost") ? "http" : "https");
  const originFromHeaders = forwardedHost ? `${forwardedProto}://${forwardedHost}` : "";
  const originFromEnv =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const origin = originFromHeaders || originFromEnv;

  const [appointments, shopName, shopPhone, shopAddress] = await Promise.all([
    db.appointment.findMany({
      where: {
        orgId,
        startsAt: { gte: rangeStart, lt: rangeEnd },
        status: { in: ["SCHEDULED", "CONFIRMED"] },
      },
      orderBy: { startsAt: "asc" },
      include: { customer: true, vehicle: true },
    }),
    getSetting(orgId, "shopName"),
    getSetting(orgId, "shopPhone"),
    getSetting(orgId, "shopAddress"),
  ]);

  const displayShop = shopName || "QNA / Noor Auto Repair";

  const titleLabel =
    mode === "today"
      ? formatDayLabel(rangeStartKey, "Today", timezone)
      : mode === "tomorrow"
        ? formatDayLabel(rangeStartKey, "Tomorrow", timezone)
        : `Next 7 days (${formatInTimeZone(rangeStart, timezone, { month: "short", day: "numeric" })}–${formatInTimeZone(dateInputInTimeZone(shiftCalendarDay(rangeEndKey, -1), timezone, new Date(Number.NaN)), timezone, { month: "short", day: "numeric" })})`;

  return (
    <>
      <PageHeader
        title="Appointment reminders"
        description="Send a confirmation text or email to each customer scheduled in the window below. Opens your phone/mail app prefilled — you hit Send."
        actions={
          <LinkButton href="/appointments" variant="secondary">
            Full schedule →
          </LinkButton>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-md border border-zinc-300 bg-white overflow-hidden text-sm">
          <TabLink href="/reminders/appointments?day=today" active={mode === "today"}>
            Today
          </TabLink>
          <TabLink href="/reminders/appointments?day=tomorrow" active={mode === "tomorrow"}>
            Tomorrow
          </TabLink>
          <TabLink href="/reminders/appointments?day=week" active={mode === "week"}>
            Next 7 days
          </TabLink>
        </div>
        <div className="ml-auto text-xs text-zinc-500">{titleLabel}</div>
      </div>

      {appointments.length === 0 ? (
        <EmptyState
          title="Nothing scheduled."
          description={`No SCHEDULED or CONFIRMED appointments fall in this window.`}
        />
      ) : (
        <Card>
          <CardHeader title={`${appointments.length} appointment${appointments.length === 1 ? "" : "s"} to remind`}>
            <span className="text-xs text-zinc-500 font-normal">
              Cancelled / no-show / completed appointments are hidden.
            </span>
          </CardHeader>
          <ul className="divide-y divide-zinc-200">
            {appointments.map((a) => {
              const name = fullName(a.customer);
              const firstName = (a.customer.firstName || name).split(" ")[0];
              const when = `${formatInTimeZone(a.startsAt, timezone, { weekday: "short", month: "short", day: "numeric" })} at ${formatTime(a.startsAt, timezone)}`;
              const vehiclePart = a.vehicle ? ` for your ${vehicleLabel(a.vehicle)}` : "";
              // Only build a shareable link if we resolved a full origin —
              // a bare "/a/<token>" path is useless inside an SMS or email
              // body because the recipient's mail/SMS client can't turn it
              // into a clickable URL.
              const shareLink =
                a.shareToken && origin
                  ? `${origin}/a/${a.shareToken}`
                  : null;

              const smsBody =
                `Hi ${firstName}, reminder: your appointment${vehiclePart} with ${displayShop} is ${when}.` +
                (a.reason ? ` Reason: ${a.reason}.` : "") +
                (shareLink ? ` Details: ${shareLink}` : "") +
                (shopPhone ? ` Call ${shopPhone} if you need to reschedule.` : " Reply if you need to reschedule.");

              const emailSubject = `${displayShop} — appointment reminder for ${when}`;
              const emailBody =
                `Hi ${firstName},\n\n` +
                `This is a reminder that you have an appointment${vehiclePart} with ${displayShop} on ${when}.\n\n` +
                (a.reason ? `Reason: ${a.reason}\n` : "") +
                (shopAddress ? `Location: ${shopAddress}\n` : "") +
                (shareLink ? `\nYou can view the details here: ${shareLink}\n` : "") +
                `\nIf you need to reschedule${shopPhone ? `, please call ${shopPhone}` : ", reply to this email"}.\n\n` +
                `Thanks,\n${displayShop}`;

              const smsHref = a.customer.phone
                ? `sms:${a.customer.phone.replace(/[^+\d]/g, "")}?body=${encodeURIComponent(smsBody)}`
                : null;
              const mailHref = a.customer.email
                ? `mailto:${encodeURIComponent(a.customer.email)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
                : null;

              return (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-20 shrink-0 text-sm font-semibold text-zinc-900">
                      {formatTime(a.startsAt, timezone)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/appointments/${a.id}`}
                          className="text-sm font-medium text-zinc-900 hover:underline"
                        >
                          {name}
                        </Link>
                        <span
                          className={
                            "text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded " +
                            statusBadgeClass(a.status)
                          }
                        >
                          {prettyStatus(a.status)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-600 truncate">
                        {a.reason}
                        {a.vehicle && ` · ${vehicleLabel(a.vehicle)}`}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-400 truncate">
                        {a.customer.phone || "no phone"}
                        {a.customer.email && ` · ${a.customer.email}`}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {smsHref ? (
                        <a
                          href={smsHref}
                          className="inline-flex items-center h-8 px-3 rounded-md text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800"
                        >
                          Text
                        </a>
                      ) : (
                        <span className="inline-flex items-center h-8 px-3 rounded-md text-xs text-zinc-400">
                          No phone
                        </span>
                      )}
                      {mailHref ? (
                        <a
                          href={mailHref}
                          className="inline-flex items-center h-8 px-3 rounded-md text-sm font-medium border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                        >
                          Email
                        </a>
                      ) : (
                        <span className="inline-flex items-center h-8 px-3 rounded-md text-xs text-zinc-400">
                          No email
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "px-3 py-1.5 text-sm " +
        (active
          ? "bg-zinc-900 text-white"
          : "text-zinc-700 hover:bg-zinc-50")
      }
    >
      {children}
    </Link>
  );
}
