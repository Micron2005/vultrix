import Link from "next/link";
import { Card, CardHeader, LinkButton } from "@/components/ui";
import { db } from "@/lib/db";

export async function LowStockBlock({
  orgId,
  limit = "10",
  title,
}: {
  orgId: string;
  limit?: string;
  title?: string;
}) {
  const activeParts = await db.part.findMany({
    where: { orgId, archived: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      partNumber: true,
      qtyOnHand: true,
      reorderLevel: true,
    },
  });
  const lowStockParts = activeParts
    .filter((part) => part.qtyOnHand <= part.reorderLevel)
    .sort(
      (a, b) =>
        a.qtyOnHand - a.reorderLevel - (b.qtyOnHand - b.reorderLevel),
    );
  if (lowStockParts.length === 0) return null;
  const visibleParts =
    limit === "all" ? lowStockParts : lowStockParts.slice(0, Number(limit));
  return (
    <Card className="mb-6 overflow-hidden border-amber-200">
      <CardHeader title={title ?? `Low stock (${lowStockParts.length})`}>
        <LinkButton href="/inventory?filter=low" variant="ghost" size="sm">
          Full inventory →
        </LinkButton>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Part</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Part #</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium text-right">On hand</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium text-right">Reorder at</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {visibleParts.map((part) => {
              const out = part.qtyOnHand <= 0;
              return (
                <tr key={part.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/inventory/${part.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {part.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-600">
                    {part.partNumber ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{part.qtyOnHand}</td>
                  <td className="px-4 py-2 text-right text-zinc-500 tabular-nums">
                    {part.reorderLevel}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={
                        "text-[10px] uppercase font-semibold px-2 py-1 rounded " +
                        (out
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-900")
                      }
                    >
                      {out ? "Out" : "Low"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
