import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import {
  Button,
  Card,
  CardHeader,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { deleteCannedJob } from "../actions";

export const dynamic = "force-dynamic";

export default async function CannedJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await requireOrgId();
  const job = await db.cannedJob.findFirst({
    where: { id, orgId },
    include: {
      laborItems: { orderBy: { sortOrder: "asc" } },
      partItems: {
        orderBy: { sortOrder: "asc" },
        include: { part: { select: { name: true, qtyOnHand: true } } },
      },
      feeItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!job) notFound();

  const hours = job.laborItems.reduce((s, l) => s + l.hours, 0);
  const feeTotal = job.feeItems.reduce((s, f) => s + f.amount, 0);
  const del = deleteCannedJob.bind(null, job.id);

  return (
    <>
      <PageHeader
        title={job.name}
        description={
          <>
            {job.category && (
              <span className="mr-2">Category: {job.category}</span>
            )}
            {job.archived && (
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                Archived
              </span>
            )}
            {job.description && (
              <span className="block mt-1">{job.description}</span>
            )}
          </>
        }
        actions={
          <>
            <LinkButton
              href={`/canned-jobs/${job.id}/edit`}
              variant="secondary"
            >
              Edit
            </LinkButton>
            <form action={del}>
              <Button type="submit" variant="danger">
                Delete
              </Button>
            </form>
          </>
        }
      />

      <Card className="mb-4">
        <CardHeader title={`Labor (${job.laborItems.length})`} />
        {job.laborItems.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500 text-center">
            No labor items.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium text-right">Hours</th>
                <th className="px-4 py-2 font-medium text-right">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {job.laborItems.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2 text-zinc-900">{l.description}</td>
                  <td className="px-4 py-2 text-right text-zinc-600">
                    {l.hours.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-600">
                    {l.rate == null ? "shop default" : formatMoney(l.rate)}
                  </td>
                </tr>
              ))}
              <tr className="bg-zinc-50">
                <td className="px-4 py-2 font-medium text-zinc-900">Total</td>
                <td className="px-4 py-2 text-right font-medium text-zinc-900">
                  {hours.toFixed(2)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mb-4">
        <CardHeader title={`Parts (${job.partItems.length})`} />
        {job.partItems.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500 text-center">
            No parts.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium">Part #</th>
                <th className="px-4 py-2 font-medium">Catalog</th>
                <th className="px-4 py-2 font-medium text-right">Qty</th>
                <th className="px-4 py-2 font-medium text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {job.partItems.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-zinc-900">{p.description}</td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-600">
                    {p.partNumber ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">
                    {p.part
                      ? `${p.part.name} · ${p.part.qtyOnHand} on hand`
                      : "free-text"}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-600">
                    {p.quantity}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-600">
                    {p.unitPrice == null
                      ? p.part?.name
                        ? "catalog"
                        : "—"
                      : formatMoney(p.unitPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mb-4">
        <CardHeader title={`Fees (${job.feeItems.length})`} />
        {job.feeItems.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500 text-center">
            No fees.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {job.feeItems.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-2 text-zinc-900">{f.description}</td>
                  <td className="px-4 py-2 text-right text-zinc-600">
                    {formatMoney(f.amount)}
                  </td>
                </tr>
              ))}
              <tr className="bg-zinc-50">
                <td className="px-4 py-2 font-medium text-zinc-900">Total</td>
                <td className="px-4 py-2 text-right font-medium text-zinc-900">
                  {formatMoney(feeTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      {job.notes && (
        <Card className="p-4 mb-4">
          <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-1">
            Internal notes
          </div>
          <div className="text-sm whitespace-pre-wrap">{job.notes}</div>
        </Card>
      )}
    </>
  );
}
