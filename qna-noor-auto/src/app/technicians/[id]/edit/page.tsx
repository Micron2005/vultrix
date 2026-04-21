import { notFound } from "next/navigation";
import { LinkButton, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { TechForm } from "../../TechForm";
import { updateTechnician } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditTechnicianPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tech = await db.technician.findUnique({ where: { id } });
  if (!tech) return notFound();

  async function save(fd: FormData) {
    "use server";
    await updateTechnician(id, fd);
  }

  return (
    <>
      <PageHeader
        title={`Edit ${tech.name}`}
        actions={
          <LinkButton href={`/technicians/${id}`} variant="secondary">
            Cancel
          </LinkButton>
        }
      />
      <div className="max-w-2xl">
        <TechForm action={save} tech={tech} submitLabel="Save changes" />
      </div>
    </>
  );
}
