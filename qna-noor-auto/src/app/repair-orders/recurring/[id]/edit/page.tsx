import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { RecurringInvoiceForm } from "../../RecurringInvoiceForm";
import { updateRecurringInvoice } from "../../../recurring-actions";

export const dynamic = "force-dynamic";

export default async function EditRecurringInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const orgId = await requireOrgId();
  const { id } = await params;
  const [series, customers, vehicles] = await Promise.all([
    db.recurringInvoice.findFirst({
      where: { id, orgId },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    }),
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
  ]);
  if (!series) notFound();
  return (
    <>
      <PageHeader title="Edit recurring invoice" description="Update this series without changing previously issued invoices." />
      <Card className="p-6">
        <RecurringInvoiceForm action={updateRecurringInvoice.bind(null, id)} customers={customers} vehicles={vehicles} initial={series} />
      </Card>
    </>
  );
}
