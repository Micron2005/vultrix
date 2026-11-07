import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Textarea,
} from "@/components/ui";
import { db } from "@/lib/db";
import { enabledFeatureSet } from "@/lib/features";
import { firstResultState } from "@/lib/firstResult";
import { metricAllowed } from "@/lib/goalAvailability";
import { dueOn, isoWeekKey, statusFor } from "@/lib/routines";
import { orgTimeZone } from "@/lib/orgTimezone";
import {
  normalizeGoalTemplateAccountType,
  templatesFor,
} from "@/lib/goalTemplates";
import { requireOrgId, requireUser } from "@/lib/session";
import { computeRoTotal } from "@/lib/roTotal";
import { localCalendarDay, shiftCalendarDay } from "@/lib/timezone";
import { formatMoney, fullName } from "@/lib/utils";
import { ShareLinkPanel } from "@/app/repair-orders/[id]/ShareLinkPanel";
import { toggleRoutineCheckOff } from "@/app/goals/routines/actions";
import { createFirstInvoice } from "./actions";
import { startFirstRoutine } from "./actions";

type StartSearchParams = {
  invoice?: string | string[];
  routine?: string | string[];
  error?: string | string[];
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function invoiceError(error: string | undefined): string | null {
  if (error === "invoice") {
    return "Enter a customer first name, a description, and an amount greater than zero.";
  }
  if (error === "email") return "Enter a valid email address or leave it blank.";
  if (error === "template") return "Choose one of the available routines.";
  return null;
}

function StartHeader({ title }: { title: string }) {
  return (
    <PageHeader
      title={title}
      actions={
        <LinkButton href="/" variant="secondary">
          Skip for now
        </LinkButton>
      }
    />
  );
}

function InvoiceForm({ error }: { error: string | undefined }) {
  return (
    <>
      <StartHeader title="Send your first invoice" />
      <Card>
        <CardHeader
          title="A quick first invoice"
          description="Create an invoice you can send to your customer right away."
        />
        <form action={createFirstInvoice} className="space-y-4 p-5">
          {invoiceError(error) && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {invoiceError(error)}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer first name">
              <Input name="firstName" autoComplete="given-name" required />
            </Field>
            <Field label="Last name (optional)">
              <Input name="lastName" autoComplete="family-name" />
            </Field>
            <Field label="Company (optional)">
              <Input name="companyName" autoComplete="organization" />
            </Field>
            <Field label="Email (optional)">
              <Input name="email" type="email" autoComplete="email" />
            </Field>
            <Field label="Phone (optional)">
              <Input name="phone" type="tel" autoComplete="tel" />
            </Field>
            <Field label="Amount">
              <Input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                required
              />
            </Field>
          </div>
          <Field label="What's it for?">
            <Textarea
              name="description"
              rows={3}
              placeholder="Logo design"
              required
            />
          </Field>
          <Button type="submit">Create invoice</Button>
        </form>
      </Card>
    </>
  );
}

async function InvoiceReady({
  invoiceId,
  orgId,
  stripeConnectChargesEnabled,
}: {
  invoiceId: string;
  orgId: string;
  stripeConnectChargesEnabled: boolean;
}) {
  const invoice = await db.repairOrder.findFirst({
    where: { id: invoiceId, orgId },
    include: {
      customer: {
        select: {
          firstName: true,
          lastName: true,
          companyName: true,
          email: true,
        },
      },
      feeLines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!invoice) return null;

  const total = await computeRoTotal(orgId, invoice.id);
  const line = invoice.feeLines[0];

  return (
    <>
      <StartHeader title="Your invoice is ready" />
      <Card>
        <CardHeader title={`Invoice #${invoice.roNumber}`} />
        <div className="space-y-4 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Customer
            </p>
            <p className="mt-1 font-medium text-zinc-900">
              {fullName(invoice.customer)}
            </p>
            {invoice.customer.email && (
              <p className="text-sm text-zinc-600">{invoice.customer.email}</p>
            )}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3 border-t border-zinc-200 pt-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Invoice line
              </p>
              <p className="mt-1 font-medium text-zinc-900">
                {line?.description ?? invoice.complaint}
              </p>
            </div>
            <p className="font-semibold text-zinc-900">
              {formatMoney(line?.amount ?? total)}
            </p>
          </div>
          <div className="flex items-center justify-between border-t border-zinc-200 pt-4 text-base">
            <span className="font-semibold text-zinc-900">Total</span>
            <span className="font-semibold text-zinc-900">
              {formatMoney(total)}
            </span>
          </div>
          {invoice.shareToken && (
            <div className="border-t border-zinc-200 pt-4">
              <p className="mb-2 text-sm font-medium text-zinc-900">
                Share this invoice
              </p>
              <ShareLinkPanel token={invoice.shareToken} pathPrefix="/e/" />
            </div>
          )}
          <p className="text-sm text-zinc-600">
            {stripeConnectChargesEnabled
              ? "Your customer can pay by card from this link."
              : "Connect payments in Billing so customers can pay by card."}
            {!stripeConnectChargesEnabled && (
              <>
                {" "}
                <Link
                  href="/billing"
                  className="font-medium text-zinc-800 underline underline-offset-2"
                >
                  Go to Billing
                </Link>
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-4">
            <LinkButton href={`/repair-orders/${invoice.id}`}>
              Open invoice
            </LinkButton>
            <LinkButton href="/" variant="secondary">
              Go to dashboard
            </LinkButton>
          </div>
        </div>
      </Card>
    </>
  );
}

function RoutinePicker({
  templates,
  error,
}: {
  templates: ReturnType<typeof templatesFor>;
  error: string | undefined;
}) {
  return (
    <>
      <StartHeader title="Pick a routine to start" />
      {invoiceError(error) && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {invoiceError(error)}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((template) => (
          <Card key={template.id} className="flex flex-col p-5">
            <h2 className="font-semibold text-zinc-900">{template.title}</h2>
            <p className="mt-2 flex-1 text-sm text-zinc-600">
              {template.blurb}
            </p>
            <form action={startFirstRoutine} className="mt-4">
              <input type="hidden" name="templateId" value={template.id} />
              <Button type="submit" variant="secondary">
                Start this
              </Button>
            </form>
          </Card>
        ))}
      </div>
      <div className="mt-5">
        <LinkButton href="/goals" variant="secondary">
          Make my own
        </LinkButton>
      </div>
    </>
  );
}

async function RoutineReady({
  routineId,
  orgId,
  timezone,
}: {
  routineId: string;
  orgId: string;
  timezone: string;
}) {
  const today = localCalendarDay(new Date(), timezone);
  const routine = await db.routine.findFirst({
    where: { id: routineId, orgId, archived: false },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!routine) return null;

  const checkOffs = await db.routineCheckOff.findMany({
    where: {
      routineId,
      orgId,
      day: { gte: shiftCalendarDay(today, -7), lte: today },
    },
    select: { itemId: true, day: true, late: true, skipped: true },
  });
  const dueToday = dueOn(routine, today);
  const nextDueDay = dueToday
    ? null
    : Array.from({ length: 7 }, (_, index) =>
        shiftCalendarDay(today, index + 1),
      ).find((day) => dueOn(routine, day)) ?? null;
  const nextWeekday = nextDueDay
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        timeZone: "UTC",
      }).format(new Date(`${nextDueDay}T12:00:00.000Z`))
    : null;
  const items = routine.items.map((item) => {
    const itemCheckOffs = checkOffs.filter(
      (checkOff) => checkOff.itemId === item.id,
    );
    const currentCheckOff =
      routine.kind === "WEEKLY"
        ? itemCheckOffs.find(
            (checkOff) => isoWeekKey(checkOff.day) === isoWeekKey(today),
          ) ?? null
        : itemCheckOffs.find((checkOff) => checkOff.day === today) ?? null;
    return {
      item,
      currentCheckOff,
      status: statusFor(
        routine,
        item,
        today,
        today,
        new Date(),
        timezone,
        itemCheckOffs,
      ),
    };
  });
  const checkedToday = checkOffs.some(
    (checkOff) => checkOff.day === today && !checkOff.skipped,
  );

  return (
    <>
      <StartHeader title={routine.title} />
      <Card>
        <CardHeader title="Today's items" />
        <div className="space-y-3 p-5">
          {dueToday ? (
            items.map(({ item, currentCheckOff, status }) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900">{item.label}</p>
                  {status === "done" && (
                    <p className="mt-1 text-xs text-zinc-500">Checked off</p>
                  )}
                </div>
                <form
                  action={toggleRoutineCheckOff.bind(null, item.id, today)}
                >
                  <Button type="submit" variant="secondary" size="sm">
                    {status === "done" ? "Undo check-off" : "Check off"}
                  </Button>
                </form>
                {currentCheckOff?.skipped && (
                  <span className="text-xs text-zinc-500">Skipped</span>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-600">
              {nextWeekday
                ? `Your first one is on ${nextWeekday}. We'll remind you here.`
                : "This routine isn't due today."}
            </p>
          )}
          {checkedToday && (
            <p className="rounded-md bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800">
              Nice, your first check-off is done. Keep the streak going tomorrow.
            </p>
          )}
          <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-4">
            <LinkButton href="/goals" variant="secondary">
              See Goals
            </LinkButton>
            <LinkButton href="/" variant="secondary">
              Go to dashboard
            </LinkButton>
          </div>
        </div>
      </Card>
    </>
  );
}

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<StartSearchParams>;
}) {
  const user = await requireUser();
  if (user.role === "STAFF" || user.accountType === "AUTO_SHOP") redirect("/");
  const orgId = await requireOrgId();
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      accountType: true,
      stripeConnectChargesEnabled: true,
      onboardingDismissedAt: true,
    },
  });
  const accountType = organization?.accountType ?? user.accountType;
  const params = await searchParams;
  const firstResult = firstResultState({
    accountType,
    features: user.features,
    repairOrderCount: 0,
    checkOffCount: 0,
    dismissed: Boolean(organization?.onboardingDismissedAt),
    role: user.role,
  });
  if (!firstResult) redirect("/");

  if (firstResult.kind === "invoice") {
    const invoiceId = firstParam(params.invoice);
    if (invoiceId) {
      const invoiceReady = await InvoiceReady({
        invoiceId,
        orgId,
        stripeConnectChargesEnabled:
          organization?.stripeConnectChargesEnabled ?? false,
      });
      if (invoiceReady) return invoiceReady;
    }
    return <InvoiceForm error={firstParam(params.error)} />;
  }

  if (firstResult.kind === "routine") {
    const routineId = firstParam(params.routine);
    const timezone = await orgTimeZone(orgId);
    if (routineId) {
      const routineReady = await RoutineReady({
        routineId,
        orgId,
        timezone,
      });
      if (routineReady) return routineReady;
    }
    const features = enabledFeatureSet(user);
    const focusPacks = user.focusPacks;
    const templates = templatesFor(
      normalizeGoalTemplateAccountType(accountType ?? "AUTO_SHOP"),
      (metric) =>
        metricAllowed(metric, { accountType: accountType ?? "", features, focusPacks }),
      focusPacks,
    ).filter((template) => Boolean(template.routine));
    return (
      <RoutinePicker templates={templates} error={firstParam(params.error)} />
    );
  }

  redirect("/");
}
