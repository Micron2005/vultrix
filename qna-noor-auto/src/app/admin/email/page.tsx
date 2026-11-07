import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
} from "@/components/ui";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/branding";
import { db } from "@/lib/db";
import { emailFromAddress } from "@/lib/email";
import { checkEmailStatus } from "@/lib/status";
import { requireSuperadmin } from "@/lib/session";
import { sendTestEmail } from "./actions";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  welcome: "Welcome",
  signup_notify: "Signup notification",
  password_reset: "Password reset",
  lead_notify: "Lead notification",
  appointment_request: "Appointment request",
  inspection: "Inspection",
  shop_order_owner: "Shop order notification",
  shop_order_buyer: "Shop order confirmation",
  shop_order_shipped: "Shop order shipped",
  daily_digest: "Daily digest",
  weekly_review: "Weekly review",
  test: "Test email",
};

function kindLabel(kind: string): string {
  if (KIND_LABELS[kind]) return KIND_LABELS[kind];
  if (kind.startsWith("reminder_")) {
    const reminder = kind.slice("reminder_".length);
    return `${reminder.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} reminder`;
  }
  return kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusLabel(status: string): string {
  if (status === "SENT") return "Sent";
  if (status === "NOT_CONFIGURED") return "Not configured";
  return "Failed";
}

function statusStyles(status: string): string {
  if (status === "SENT") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "NOT_CONFIGURED") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-red-200 bg-red-50 text-red-800";
}

function sevenDaysAgo(): Date {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

export default async function EmailHealthPage({
  searchParams,
}: {
  searchParams?: Promise<{
    tab?: string;
    notice?: string;
    error?: string;
  }>;
}) {
  await requireSuperadmin();
  const sp = (await searchParams) ?? {};
  const tab = sp.tab === "failed" ? "failed" : "all";
  const since = sevenDaysAgo();
  const failedStatuses = ["FAILED", "NOT_CONFIGURED"];
  const [emailStatus, sentCount, failedCount, notConfiguredCount, emails] =
    await Promise.all([
      checkEmailStatus(),
      db.emailLog.count({ where: { status: "SENT", createdAt: { gte: since } } }),
      db.emailLog.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
      db.emailLog.count({
        where: { status: "NOT_CONFIGURED", createdAt: { gte: since } },
      }),
      db.emailLog.findMany({
        where: tab === "failed" ? { status: { in: failedStatuses } } : undefined,
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { organization: { select: { name: true } } },
      }),
    ]);
  const domainStyles =
    emailStatus.state === "operational"
      ? "text-emerald-700"
      : emailStatus.state === "not_configured"
        ? "text-amber-800"
        : "text-red-700";
  const stats = [
    {
      label: "Sent",
      count: sentCount,
      color: "text-emerald-700",
    },
    {
      label: "Failed",
      count: failedCount,
      color: "text-red-700",
    },
    {
      label: "Not configured",
      count: notConfiguredCount,
      color: "text-amber-800",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email health"
        description={`Monitor transactional email for ${APP_NAME}.`}
      />

      {sp.notice && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {sp.notice}
        </div>
      )}
      {sp.error && (
        <div className="break-words rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {sp.error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Email setup" />
          <div className="space-y-3 p-4 text-sm text-zinc-700">
            <div className="flex flex-wrap justify-between gap-2">
              <span>Resend API key</span>
              <span className="font-medium text-zinc-900">
                {process.env.RESEND_API_KEY ? "Set" : "Not set"}
              </span>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span>Sender in use</span>
              <span className="break-all text-right font-medium text-zinc-900">
                {emailFromAddress()}
              </span>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span>Resend domain</span>
              <span className={`text-right font-medium ${domainStyles}`}>
                {emailStatus.detail}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Last seven days" />
          <div className="grid grid-cols-3 gap-2 p-4 text-center">
            {stats.map(({ label, count, color }) => (
              <div
                key={label}
                className="min-w-0 rounded-lg border border-zinc-200 p-3"
              >
                <div className={`text-2xl font-semibold ${color}`}>
                  {count}
                </div>
                <div className="mt-1 text-xs text-zinc-600">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Send a test email" />
        <form action={sendTestEmail} className="space-y-3 p-4">
          <p className="text-sm text-zinc-600">
            Send a short branded message to confirm the email provider responds.
          </p>
          <Field label="Recipient">
            <Input
              type="email"
              name="to"
              required
              defaultValue={SUPPORT_EMAIL}
              autoComplete="email"
            />
          </Field>
          <Button type="submit">Send test email</Button>
        </form>
      </Card>

      <Card>
        <CardHeader title={`Recent emails (${emails.length})`} />
        <div className="flex gap-2 border-b border-zinc-200 px-4 py-3">
          <Link
            href="/admin/email?tab=all"
            aria-current={tab === "all" ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm ${tab === "all" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
          >
            All
          </Link>
          <Link
            href="/admin/email?tab=failed"
            aria-current={tab === "failed" ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm ${tab === "failed" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
          >
            Failed
          </Link>
        </div>
        {emails.length ? (
          <div className="divide-y divide-zinc-100">
            {emails.map((email) => (
              <article
                key={email.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-900">
                      {kindLabel(email.kind)}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyles(email.status)}`}
                    >
                      {statusLabel(email.status)}
                    </span>
                  </div>
                  <p className="break-all text-sm text-zinc-700">
                    {email.to}
                  </p>
                  <p className="break-words text-sm text-zinc-600">
                    {email.subject}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {email.organization?.name ?? "Platform"}
                  </p>
                  {email.error && (
                    <p className="break-words rounded-md bg-red-50 px-2 py-1.5 text-sm text-red-800">
                      {email.error}
                    </p>
                  )}
                </div>
                <time
                  dateTime={email.createdAt.toISOString()}
                  className="shrink-0 text-xs text-zinc-500"
                >
                  {email.createdAt.toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-zinc-500">
            {tab === "failed"
              ? "No failed or unconfigured emails yet."
              : "No emails have been logged yet."}
          </div>
        )}
      </Card>
    </div>
  );
}
