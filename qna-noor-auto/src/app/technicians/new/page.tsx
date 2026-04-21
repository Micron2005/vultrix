import { LinkButton, PageHeader } from "@/components/ui";
import { TechForm } from "../TechForm";
import { createTechnician } from "../actions";

export default function NewTechnicianPage() {
  return (
    <>
      <PageHeader
        title="New technician"
        description="Add a tech so you can assign labor lines to them and track hours"
        actions={
          <LinkButton href="/technicians" variant="secondary">
            Cancel
          </LinkButton>
        }
      />
      <div className="max-w-2xl">
        <TechForm action={createTechnician} submitLabel="Create technician" />
      </div>
    </>
  );
}
