import { Card, PageHeader } from "@/components/ui";
import { CustomerForm } from "../CustomerForm";
import { createCustomer } from "../actions";

export default function NewCustomerPage() {
  return (
    <>
      <PageHeader title="New customer" />
      <Card className="p-6">
        <CustomerForm action={createCustomer} submitLabel="Create customer" />
      </Card>
    </>
  );
}
