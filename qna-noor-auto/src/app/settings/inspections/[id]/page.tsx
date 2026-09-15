import { notFound } from "next/navigation";
import { Card, CardHeader, Input, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";
import { renameInspectionTemplate, deleteInspectionTemplate, saveInspectionTemplateItems } from "../actions";
import { InspectionTemplateEditor } from "./InspectionTemplateEditor";

export const dynamic = "force-dynamic";

export default async function InspectionTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user.accountType !== "AUTO_SHOP") notFound();
  const orgId = await requireOrgId();
  const { id } = await params;
  const template = await db.inspectionTemplate.findFirst({
    where: { id, orgId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) notFound();
  return (
    <>
      <PageHeader title="Edit inspection template" description="Group checklist items into sections for the phone runner." />
      <div className="max-w-4xl space-y-4">
        <Card>
          <CardHeader title="Template name" />
          <form action={renameInspectionTemplate.bind(null, template.id)} className="flex items-end gap-3 p-4">
            <label className="flex-1 text-sm font-medium text-zinc-700">
              Name
              <Input name="name" defaultValue={template.name} required className="mt-1" />
            </label>
            <button type="submit" className="h-9 rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50">Save name</button>
          </form>
        </Card>
        <InspectionTemplateEditor
          initialItems={template.items.map((item) => ({ section: item.section, name: item.name }))}
          saveAction={saveInspectionTemplateItems.bind(null, template.id)}
        />
        <form action={deleteInspectionTemplate.bind(null, template.id)}>
          <button type="submit" className="text-sm text-red-600 hover:underline">Delete this template</button>
        </form>
      </div>
    </>
  );
}
