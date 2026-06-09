import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { CustomerForm } from "../../CustomerForm";
import { updateCustomer } from "../../actions";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const orgId = await requireOrgId();
  const { id } = await params;
  const customer = await db.customer.findFirst({ where: { id, orgId } });
  if (!customer) notFound();

  const action = updateCustomer.bind(null, customer.id);

  return (
    <>
      <PageHeader title={`Edit ${customer.firstName} ${customer.lastName}`} />
      <Card className="p-6">
        <CustomerForm
          action={action}
          customer={customer}
          submitLabel="Save changes"
        />
      </Card>
    </>
  );
}
