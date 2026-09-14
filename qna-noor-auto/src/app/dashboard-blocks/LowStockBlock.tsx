import Link from "next/link";
import { Badge, Card, CardHeader, LinkButton, Table, TBody, TD, THead, TR } from "@/components/ui";
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
      <Table>
          <THead>
            <tr>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Part</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Part #</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium text-right">On hand</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium text-right">Reorder at</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium text-right">Status</th>
            </tr>
          </THead>
          <TBody>
            {visibleParts.map((part) => {
              const out = part.qtyOnHand <= 0;
              return (
                <TR key={part.id}>
                  <TD>
                    <Link
                      href={`/inventory/${part.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {part.name}
                    </Link>
                  </TD>
                  <TD className="font-mono text-xs text-zinc-600">
                    {part.partNumber ?? "—"}
                  </TD>
                  <TD numeric>{part.qtyOnHand}</TD>
                  <TD numeric className="text-zinc-500">
                    {part.reorderLevel}
                  </TD>
                  <TD numeric>
                    <Badge tone={out ? "danger" : "warning"}>{out ? "Out" : "Low"}</Badge>
                  </TD>
                </TR>
              );
            })}
          </TBody>
      </Table>
    </Card>
  );
}
