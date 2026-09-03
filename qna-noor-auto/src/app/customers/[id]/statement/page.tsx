import { notFound } from "next/navigation";
import {
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
} from "@/components/ui";
import { loadOpenAR } from "@/lib/ar";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { getAllSettings } from "@/lib/shop";
import { formatDate, formatMoney, fullName } from "@/lib/utils";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function CustomerStatementPage({
  params,
}: {
  params: Params;
}) {
  const orgId = await requireOrgId();
  const { id } = await params;
  const customer = await db.customer.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      companyName: true,
      street: true,
      city: true,
      state: true,
      zip: true,
      email: true,
      phone: true,
    },
  });
  if (!customer) notFound();

  const [settings, ar] = await Promise.all([
    getAllSettings(orgId),
    loadOpenAR(orgId, customer.id),
  ]);
  const asOf = new Date();
  const address = [
    customer.street,
    [customer.city, customer.state].filter(Boolean).join(", "),
    customer.zip,
  ]
    .filter(Boolean)
    .join(" · ");
  const contact = [customer.phone, customer.email].filter(Boolean).join(" · ");

  return (
    <div data-force-light className="rounded-lg bg-zinc-50 p-4 text-zinc-900">
      <div className="mx-auto max-w-5xl print:max-w-full">
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white print:rounded-none print:border-0">
          <header className="border-b border-zinc-200 px-8 py-6">
            <div className="flex items-start justify-between gap-8">
              <div>
                <div className="text-xl font-semibold text-zinc-900">
                  {settings.shopName || "QNA / Noor Auto Repair"}
                </div>
                {settings.shopAddress && (
                  <div className="mt-1 whitespace-pre-line text-xs text-zinc-600">
                    {settings.shopAddress}
                  </div>
                )}
                {(settings.shopPhone || settings.shopEmail) && (
                  <div className="mt-0.5 text-xs text-zinc-600">
                    {[settings.shopPhone, settings.shopEmail]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold uppercase tracking-wider text-zinc-900">
                  Customer statement
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  As of {formatDate(asOf)}
                </div>
              </div>
            </div>
          </header>

          <section className="border-b border-zinc-200 px-8 py-5">
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Bill to
            </div>
            <div className="mt-1 font-medium text-zinc-900">
              {fullName(customer)}
            </div>
            {address && <div className="text-sm text-zinc-600">{address}</div>}
            {contact && <div className="text-sm text-zinc-600">{contact}</div>}
          </section>

          {ar.invoices.length === 0 ? (
            <div className="px-8 py-10">
              <EmptyState
                title="Nothing is owed"
                description="This customer has no open invoiced balance as of today."
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto px-8 py-6">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-2 py-2 font-medium">Invoice date</th>
                      <th className="px-2 py-2 font-medium">Invoice #</th>
                      <th className="px-2 py-2 font-medium">Vehicle</th>
                      <th className="px-2 py-2 text-right font-medium">
                        Invoice total
                      </th>
                      <th className="px-2 py-2 text-right font-medium">
                        Paid to date
                      </th>
                      <th className="px-2 py-2 text-right font-medium">
                        Balance
                      </th>
                      <th className="px-2 py-2 text-right font-medium">
                        Days outstanding
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {ar.invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="px-2 py-3">{formatDate(invoice.invoiceDate)}</td>
                        <td className="px-2 py-3">#{invoice.invoiceNumber}</td>
                        <td className="px-2 py-3">{invoice.vehicle}</td>
                        <td className="px-2 py-3 text-right tabular-nums">
                          {formatMoney(invoice.total)}
                        </td>
                        <td className="px-2 py-3 text-right tabular-nums">
                          {formatMoney(invoice.paid)}
                        </td>
                        <td className="px-2 py-3 text-right font-semibold tabular-nums">
                          {formatMoney(invoice.balance)}
                        </td>
                        <td className="px-2 py-3 text-right tabular-nums">
                          {invoice.daysOutstanding}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-zinc-300 bg-zinc-50 font-semibold">
                    <tr>
                      <td className="px-2 py-3" colSpan={5}>
                        Total owed
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums">
                        {formatMoney(ar.total)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <Card className="mx-8 mb-8 print:mx-0">
                <CardHeader title="Aging summary" />
                <div className="grid grid-cols-2 gap-4 p-4 text-sm md:grid-cols-4">
                  <AgingStat label="0–30 days" value={ar.buckets["0-30"]} />
                  <AgingStat label="31–60 days" value={ar.buckets["31-60"]} />
                  <AgingStat label="61–90 days" value={ar.buckets["61-90"]} />
                  <AgingStat label="90+ days" value={ar.buckets["90+"]} />
                </div>
                <p className="px-4 pb-4 text-xs text-zinc-500">
                  Aging counts whole days since the invoice date because no
                  payment terms are configured.
                </p>
              </Card>
            </>
          )}
        </div>

        <div className="mt-4 flex justify-center gap-2 print:hidden">
          <PrintButton />
          <LinkButton href={`/customers/${customer.id}`} variant="secondary">
            Back to customer
          </LinkButton>
        </div>
      </div>
    </div>
  );
}

function AgingStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-900">
        {formatMoney(value)}
      </div>
    </div>
  );
}
