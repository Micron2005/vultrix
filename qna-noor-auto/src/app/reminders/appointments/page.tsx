import Link from "next/link";
import { headers } from "next/headers";
import { db } from "@/lib/db";
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

function parseDayParam(day?: string): Date {
  const d = new Date();
  if (day === "today") {
    // fall through
  } else if (day === "week") {
    // Special key handled separately below — caller looks at range directly.
    // Return today; the page uses the raw param for range expansion.
  } else {
    // default: tomorrow
    d.setDate(d.getDate() + 1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDayLabel(d: Date, label: string): string {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(d);
  const mon = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
  return `${label} · ${weekday}, ${mon}`;
}

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export default async function AppointmentRemindersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const mode = sp.day === "today" ? "today" : sp.day === "week" ? "week" : "tomorrow";

  const rangeStart = new Date();
  rangeStart.setHours(0, 0, 0, 0);
  if (mode === "tomorrow") rangeStart.setDate(rangeStart.getDate() + 1);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + (mode === "week" ? 7 : 1));

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
        startsAt: { gte: rangeStart, lt: rangeEnd },
        status: { in: ["SCHEDULED", "CONFIRMED"] },
      },
      orderBy: { startsAt: "asc" },
      include: { customer: true, vehicle: true },
    }),
    getSetting("shopName"),
    getSetting("shopPhone"),
    getSetting("shopAddress"),
  ]);

  const displayShop = shopName || "QNA / Noor Auto Repair";

  const titleLabel =
    mode === "today"
      ? formatDayLabel(rangeStart, "Today")
      : mode === "tomorrow"
        ? formatDayLabel(rangeStart, "Tomorrow")
        : `Next 7 days (${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(rangeStart)}–${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(rangeEnd.getTime() - 1))})`;

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
              const when = `${new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(a.startsAt)} at ${formatTime(a.startsAt)}`;
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
                      {formatTime(a.startsAt)}
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
