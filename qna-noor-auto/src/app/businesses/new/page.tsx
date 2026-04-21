import { Card, PageHeader } from "@/components/ui";
import { CustomerForm } from "../../customers/CustomerForm";
import { createCustomer } from "../../customers/actions";

export default function NewBusinessPage() {
  return (
    <>
      <PageHeader title="New business" />
      <Card className="p-6">
        <CustomerForm
          action={createCustomer}
          submitLabel="Create business"
          defaultType="BUSINESS"
        />
      </Card>
    </>
  );
}
