import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { adjustStock, deletePart, toggleArchived } from "../actions";
import { SupplierLinks } from "@/app/vehicle-search/SupplierLinks";

export const dynamic = "force-dynamic";

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case "RECEIVE":
      return "Received";
    case "USE_RO":
      return "Used on RO";
    case "RESTOCK_RO":
      return "Restocked (line removed)";
    case "ADJUST":
      return "Adjustment";
    case "INITIAL":
      return "Opening balance";
    default:
      return reason;
  }
}

export default async function PartDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await requireOrgId();

  const part = await db.part.findFirst({
    where: { id, orgId },
    include: {
      stockMoves: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          partLine: {
            include: {
              repairOrder: { select: { id: true, roNumber: true } },
            },
          },
        },
      },
      partLines: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          repairOrder: {
            select: { id: true, roNumber: true, openedAt: true, status: true },
          },
        },
      },
    },
  });
  if (!part) notFound();

  const lowStock = part.qtyOnHand <= part.reorderLevel;
  const outOfStock = part.qtyOnHand <= 0;

  const boundAdjust = adjustStock.bind(null, id);
  const boundDelete = deletePart.bind(null, id);
  const boundToggleArchive = toggleArchived.bind(null, id, !part.archived);

  return (
    <>
      <PageHeader
        title={part.name}
        description={
          part.category || part.description ? (
            <>
              {part.category && (
                <span className="mr-2 inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {part.category}
                </span>
              )}
              {part.description}
            </>
          ) : undefined
        }
        actions={
          <div className="flex gap-2">
            <LinkButton href={`/inventory/${id}/qr`} variant="secondary">
              QR sticker
            </LinkButton>
            <LinkButton href={`/inventory/${id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            <form action={boundToggleArchive}>
              <Button variant="secondary" type="submit">
                {part.archived ? "Unarchive" : "Archive"}
              </Button>
            </form>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card
          className={
            outOfStock
              ? "border-red-200 bg-red-50"
              : lowStock
                ? "border-amber-200 bg-amber-50"
                : ""
          }
        >
          <div className="p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500">
              On hand
            </div>
            <div
              className={`mt-1 text-3xl font-semibold ${
                outOfStock
                  ? "text-red-900"
                  : lowStock
                    ? "text-amber-900"
                    : "text-zinc-900"
              }`}
            >
              {part.qtyOnHand}
              {part.unit && (
                <span className="ml-1.5 text-base font-normal text-zinc-400">
                  {part.unit}
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              Reorder at or below {part.reorderLevel}
              {outOfStock && " — OUT OF STOCK"}
              {!outOfStock && lowStock && " — LOW"}
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500">
              Cost / Price
            </div>
            <div className="mt-1 text-xl font-semibold">
              {part.costPrice != null ? `$${part.costPrice.toFixed(2)}` : "—"}
              <span className="text-zinc-400 mx-2">→</span>
              {part.unitPrice != null ? `$${part.unitPrice.toFixed(2)}` : "—"}
            </div>
            {part.costPrice != null &&
              part.unitPrice != null &&
              part.costPrice > 0 && (
                <div className="text-xs text-zinc-500 mt-1">
                  {`Markup ${(((part.unitPrice - part.costPrice) / part.costPrice) * 100).toFixed(1)}%`}
                </div>
              )}
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500">
              Supplier / Part #
            </div>
            <div className="mt-1 text-sm">
              <div className="font-medium text-zinc-900">{part.source ?? "—"}</div>
              <div className="text-zinc-500 tabular-nums">
                {part.partNumber ?? "—"}
              </div>
            </div>
            {part.location && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                <span className="text-zinc-400">Location</span>
                {part.location}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Look up on">
          <span className="text-xs text-zinc-500 font-normal">
            Opens the supplier&apos;s site in a new tab prefilled with this
            part. Sign in there with your pro account.
          </span>
        </CardHeader>
        <div className="p-4">
          <SupplierLinks
            ctx={{
              partName: part.name,
              partNumber: part.partNumber,
              year:
                part.fitsYearMin && part.fitsYearMax && part.fitsYearMin === part.fitsYearMax
                  ? part.fitsYearMin
                  : null,
              make: part.fitsMake,
              model: part.fitsModel,
            }}
          />
          {(part.fitsMake || part.fitsModel || part.fitsYearMin || part.fitsYearMax) && (
            <div className="mt-2 text-xs text-zinc-500">
              Fits{" "}
              {[
                [part.fitsYearMin, part.fitsYearMax]
                  .filter((n) => n != null)
                  .join("–"),
                part.fitsMake,
                part.fitsModel,
              ]
                .filter(Boolean)
                .join(" ")}
            </div>
          )}
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader title="Receive / adjust stock" />
        <form action={boundAdjust} className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Quantity change (+/−)">
            <Input
              name="delta"
              inputMode="decimal"
              required
              placeholder="e.g. 10 or -1"
            />
          </Field>
          <Field label="Reason">
            <Select name="reason" defaultValue="RECEIVE">
              <option value="RECEIVE">Received from supplier</option>
              <option value="ADJUST">Manual adjustment</option>
            </Select>
          </Field>
          <Field label="Note (optional)">
            <Input name="note" placeholder="PO #, supplier, etc." />
          </Field>
          <div className="flex items-end">
            <Button type="submit">Apply</Button>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader title={`Stock history (${part.stockMoves.length})`} />
          {part.stockMoves.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">No moves yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Reason</th>
                  <th className="px-4 py-2 font-medium w-20 text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {part.stockMoves.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2 text-xs text-zinc-600 whitespace-nowrap">
                      {formatDateTime(m.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <div>{reasonLabel(m.reason)}</div>
                      {m.partLine?.repairOrder && (
                        <Link
                          href={`/repair-orders/${m.partLine.repairOrder.id}`}
                          className="text-indigo-700 hover:underline"
                        >
                          RO #{m.partLine.repairOrder.roNumber}
                        </Link>
                      )}
                      {m.note && (
                        <div className="text-zinc-500">{m.note}</div>
                      )}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums font-semibold ${
                        m.delta > 0 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {m.delta > 0 ? `+${m.delta}` : m.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader title={`Used on (${part.partLines.length})`} />
          {part.partLines.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">
              Not used on any RO yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2 font-medium">RO</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium w-16 text-right">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {part.partLines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2">
                      {l.repairOrder ? (
                        <Link
                          href={`/repair-orders/${l.repairOrder.id}`}
                          className="text-indigo-700 hover:underline"
                        >
                          #{l.repairOrder.roNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-600">
                      {l.repairOrder
                        ? formatDateTime(l.repairOrder.openedAt)
                        : formatDateTime(l.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {l.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {part.notes && (
        <Card className="mb-6">
          <CardHeader title="Notes" />
          <div className="p-4 text-sm whitespace-pre-wrap">{part.notes}</div>
        </Card>
      )}

      <Card className="border-red-200">
        <CardHeader title="Danger zone" />
        <div className="p-4 flex items-center gap-4">
          <form action={boundDelete}>
            <Button variant="danger" type="submit">
              Delete part
            </Button>
          </form>
          <span className="text-xs text-zinc-500">
            Deletes the catalog entry. Historical RO part lines are preserved but will no longer link to a catalog part. Prefer archiving.
          </span>
        </div>
      </Card>
    </>
  );
}
