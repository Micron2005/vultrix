import { PageHeader } from "@/components/ui";
import { PartForm } from "../PartForm";
import { createPart } from "../actions";

export default function NewPartPage() {
  return (
    <>
      <PageHeader
        title="Add part"
        description="Add a part you stock so you can track qty on hand and auto-deduct from ROs."
      />
      <PartForm action={createPart} submitLabel="Create part" isNew />
    </>
  );
}
