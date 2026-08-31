import Link from "next/link";
import {
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { StatCard } from "@/components/StatCard";
import { loadOpenAR } from "@/lib/ar";
import { enabledFeatureSet } from "@/lib/features";
import { getCurrentUser, requireOrgId } from "@/lib/session";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

const bucketColumns = [
  { key: "0-30", label: "0–30" },
  { key: "31-60", label: "31–60" },
  { key: "61-90", label: "61–90" },
  { key: "90+", label: "90+" },
] as const;

export default async function AccountsReceivablePage() {
  const orgId = await requireOrgId();
  const user = await getCurrentUser();
  const hasInvoices = enabledFeatureSet(user ?? {}).has("invoices");

  if (!hasInvoices) {
    return (
      <>
        <PageHeader
          title="A/R aging"
          description="Accounts receivable"
          actions={
            <LinkButton href="/reports" variant="secondary">
              Back to reports
            </LinkButton>
          }
        />
        <EmptyState
          title="A/R needs invoicing"
          description="Turn on invoicing to track open invoices and customer balances."
        />
      </>
    );
  }

  const ar = await loadOpenAR(orgId);
  const asOf = new Date();

  return (
    <>
      <PageHeader
        title="A/R aging"
        description={`Open invoice balances as of ${formatDate(asOf)}`}
        actions={
          <LinkButton href="/reports" variant="secondary">
            Back to reports
          </LinkButton>
        }
      />
      <p className="mb-6 text-sm text-zinc-600">
        Aging counts whole days since the invoice date because no payment terms
        are configured.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard
          label="Total owed"
          value={formatMoney(ar.total)}
          highlight={ar.total > 0}
        />
        {bucketColumns.map((bucket) => (
          <StatCard
            key={bucket.key}
            label={`${bucket.label} days`}
            value={formatMoney(ar.buckets[bucket.key])}
            highlight={bucket.key === "90+" && ar.buckets[bucket.key] > 0}
          />
        ))}
      </div>

      <Card>
        {ar.customers.length === 0 ? (
          <EmptyState
            title="No open invoices"
            description="Customers with unpaid invoiced repair orders will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 text-right font-medium">Invoices</th>
                  {bucketColumns.map((bucket) => (
                    <th
                      key={bucket.key}
                      className={`px-4 py-3 text-right font-medium ${
                        bucket.key === "90+" ? "text-red-700" : ""
                      }`}
                    >
                      {bucket.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {ar.customers.map((summary) => (
                  <tr key={summary.customer.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/customers/${summary.customer.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {summary.customer.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {summary.invoices}
                    </td>
                    {bucketColumns.map((bucket) => (
                      <td
                        key={bucket.key}
                        className={`px-4 py-3 text-right tabular-nums ${
                          bucket.key === "90+" && summary.buckets[bucket.key] > 0
                            ? "bg-red-50 font-semibold text-red-700"
                            : ""
                        }`}
                      >
                        {formatMoney(summary.buckets[bucket.key])}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatMoney(summary.total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/customers/${summary.customer.id}/statement`}
                        className="text-sm font-medium text-zinc-700 hover:underline"
                      >
                        Statement
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-zinc-300 bg-zinc-50 font-semibold">
                <tr>
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {ar.invoices.length}
                  </td>
                  {bucketColumns.map((bucket) => (
                    <td
                      key={bucket.key}
                      className="px-4 py-3 text-right tabular-nums"
                    >
                      {formatMoney(ar.buckets[bucket.key])}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(ar.total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
