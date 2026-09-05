import Link from "next/link";
import { db } from "@/lib/db";
import { repairOrderNouns } from "@/lib/features";
import { requireOrgId, requireUser } from "@/lib/session";
import {
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";
import { getDueInvoiceOccurrences } from "@/lib/recurringInvoices";
import {
  deleteRecurringInvoice,
  issueRecurringInvoiceOccurrence,
  skipRecurringInvoiceOccurrence,
  toggleRecurringInvoice,
} from "../recurring-actions";

export const dynamic = "force-dynamic";

function repeatDescription(interval: string): string {
  return interval === "BIWEEKLY"
    ? "Every 2 weeks"
    : interval[0] + interval.slice(1).toLowerCase();
}

function customerName(customer: {
  firstName: string;
  lastName: string;
  companyName: string | null;
}) {
  return customer.companyName || `${customer.firstName} ${customer.lastName}`;
}

export default async function RecurringInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const orgId = await requireOrgId();
  const user = await requireUser();
  const nouns = repairOrderNouns(user.accountType);
  const { error } = await searchParams;
  const [series, due] = await Promise.all([
    db.recurringInvoice.findMany({
      where: { orgId },
      include: {
        customer: {
          select: { firstName: true, lastName: true, companyName: true },
        },
      },
      orderBy: { nextRunAt: "asc" },
    }),
    getDueInvoiceOccurrences(orgId),
  ]);
  const visibleDue = Array.from(
    due.reduce((bySeries, occurrence) => {
      if (!bySeries.has(occurrence.recurringId)) {
        bySeries.set(occurrence.recurringId, occurrence);
      }
      return bySeries;
    }, new Map<string, (typeof due)[number]>()),
  ).map(([, occurrence]) => occurrence);

  return (
    <>
      <PageHeader
        title={`Recurring ${nouns.plural}`}
        description={`Automatically issue or review repeating ${nouns.singular.toLowerCase()}s.`}
        actions={<LinkButton href="/repair-orders/recurring/new">+ New recurring {nouns.singular.toLowerCase()}</LinkButton>}
      />
      {error === "stale_occurrence" && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          That occurrence is no longer next due. Reload the page and try again.
        </div>
      )}
      {visibleDue.length > 0 && (
        <Card className="mb-4">
          <CardHeader title="Due now" />
          <div className="divide-y divide-zinc-200">
            {visibleDue.map((item) => {
              const laterCount = due.filter(
                (occurrence) => occurrence.recurringId === item.recurringId,
              ).length - 1;
              return (
                <div key={`${item.recurringId}-${item.occurrence.toISOString()}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="font-medium text-zinc-900">
                      {item.label || `Recurring ${nouns.singular.toLowerCase()}`} · {item.customerName}
                    </div>
                    <div className="text-sm text-zinc-500">
                      {repeatDescription(item.interval)} · {formatDate(item.occurrence)} · {formatMoney(item.total)}
                    </div>
                    {laterCount > 0 && (
                      <div className="text-xs text-zinc-500">
                        Issue or skip this occurrence first; {laterCount} later due{" "}
                        {laterCount === 1 ? "occurrence follows" : "occurrences follow"}.
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <form action={issueRecurringInvoiceOccurrence}>
                      <input type="hidden" name="recurringId" value={item.recurringId} />
                      <input type="hidden" name="occurrence" value={item.occurrence.toISOString()} />
                      <button className="h-8 rounded-md bg-[var(--vx-accent-600)] px-3 text-sm font-medium text-white" type="submit">Issue</button>
                    </form>
                    <form action={skipRecurringInvoiceOccurrence}>
                      <input type="hidden" name="recurringId" value={item.recurringId} />
                      <input type="hidden" name="occurrence" value={item.occurrence.toISOString()} />
                      <button className="h-8 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700" type="submit">Skip</button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      <Card>
        <CardHeader title="Recurring series" />
        {series.length === 0 ? (
          <EmptyState
            title={`No recurring ${nouns.plural.toLowerCase()} yet.`}
            description={`Set up a repeating ${nouns.singular.toLowerCase()} to save time on regular billing.`}
            action={<LinkButton href="/repair-orders/recurring/new">+ New recurring {nouns.singular.toLowerCase()}</LinkButton>}
          />
        ) : (
          <div className="divide-y divide-zinc-200">
            {series.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-[16rem] flex-1">
                  <div className="font-medium text-zinc-900">{item.label || `Recurring ${nouns.singular.toLowerCase()}`}</div>
                  <div className="text-sm text-zinc-500">
                    {customerName(item.customer)} · {repeatDescription(item.interval)} · next {formatDate(item.nextRunAt)}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs ${item.autoPost ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                  {item.autoPost ? "Automatic" : "Review"}
                </span>
                <span className={`rounded-full px-2 py-1 text-xs ${item.active ? "bg-zinc-100 text-zinc-700" : "bg-zinc-200 text-zinc-500"}`}>
                  {item.active ? "Active" : "Paused"}
                </span>
                <Link href={`/repair-orders/recurring/${item.id}/edit`} className="h-8 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700">Edit</Link>
                <form action={toggleRecurringInvoice}>
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className="h-8 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700">{item.active ? "Pause" : "Resume"}</button>
                </form>
                <form action={deleteRecurringInvoice}>
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className="h-8 rounded-md border border-red-200 px-3 text-sm text-red-700">Delete</button>
                </form>
              </div>
            ))}
          </div>
        )}
        <p className="border-t border-zinc-200 px-4 py-3 text-xs text-zinc-500">
          Deleting a recurring series keeps all previously issued {nouns.plural.toLowerCase()}.
        </p>
      </Card>
    </>
  );
}
