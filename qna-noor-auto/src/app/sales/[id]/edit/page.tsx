import { notFound } from "next/navigation";
import {
  Card,
  CardHeader,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { db } from "@/lib/db";
import { localCalendarDay } from "@/lib/timezone";
import { requireSalesOrgId, updateSaleAction } from "../../actions";
import { SaleForm } from "../../SaleForm";

export const dynamic = "force-dynamic";

export default async function EditSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { orgId, timezone, hasInventory } = await requireSalesOrgId();
  const { id } = await params;
  const [sale, parts] = await Promise.all([
    db.sale.findFirst({ where: { id, orgId } }),
    hasInventory
      ? db.part.findMany({
          where: { orgId, archived: false },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            partNumber: true,
            category: true,
            unit: true,
            costPrice: true,
            unitPrice: true,
            qtyOnHand: true,
          },
        })
      : Promise.resolve([]),
  ]);
  if (!sale) notFound();
  const action = updateSaleAction.bind(null, sale.id);

  return (
    <>
      <PageHeader
        title="Edit sale"
        description="Update the product, price, quantity, or date. Stock and money in will stay in sync."
        actions={<LinkButton href="/sales" variant="secondary">Back to sales</LinkButton>}
      />
      <Card>
        <CardHeader title={sale.itemName} />
        <div className="p-4">
          <SaleForm
            action={action}
            parts={parts}
            submitLabel="Save changes"
            initial={{
              soldAt: localCalendarDay(sale.soldAt, timezone),
              partId: sale.partId,
              itemName: sale.itemName,
              quantity: sale.quantity,
              unitPrice: sale.unitPrice,
              unitCost: sale.unitCost,
              channel: sale.channel,
              note: sale.note,
            }}
          />
        </div>
      </Card>
    </>
  );
}
