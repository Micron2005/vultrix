import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { fullName } from "@/lib/utils";
import { RecurringInvoiceForm } from "../RecurringInvoiceForm";
import { createRecurringInvoice } from "../../recurring-actions";

export const dynamic = "force-dynamic";

export default async function NewRecurringInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ sourceId?: string }>;
}) {
  const orgId = await requireOrgId();
  const { sourceId } = await searchParams;
  const [customers, vehicles, source] = await Promise.all([
    db.customer.findMany({
      where: { orgId },
      select: { id: true, firstName: true, lastName: true, companyName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 2000,
    }),
    db.vehicle.findMany({
      where: { orgId },
      select: { id: true, customerId: true, year: true, make: true, model: true, unitNumber: true },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    sourceId
      ? db.repairOrder.findFirst({
          where: { id: sourceId, orgId },
          include: { laborLines: true, partLines: true, feeLines: true, customer: true },
        })
      : null,
  ]);
  if (sourceId && !source) notFound();
  const initial = source
    ? {
        customerId: source.customerId,
        vehicleId: source.vehicleId,
        taxRate: source.taxRate,
        discount: source.discount,
        notes: source.notes,
        lines: [
          ...source.laborLines.map((line) => ({ kind: "LABOR", description: line.description, quantity: line.hours, unitPrice: line.rate, partNumber: null })),
          ...source.partLines.map((line) => ({ kind: "PART", description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, partNumber: line.partNumber })),
          ...source.feeLines.map((line) => ({ kind: "FEE", description: line.description, quantity: 1, unitPrice: line.amount, partNumber: null })),
        ],
      }
    : undefined;
  return (
    <>
      <PageHeader
        title="New recurring invoice"
        description={source ? `Repeat the invoice for ${fullName(source.customer)}.` : "Set up a repeating invoice series."}
      />
      <Card className="p-6">
        <RecurringInvoiceForm action={createRecurringInvoice} customers={customers} vehicles={vehicles} initial={initial} />
      </Card>
    </>
  );
}
