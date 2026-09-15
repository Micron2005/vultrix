import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, Input, PageHeader } from "@/components/ui";
import { requireOrgId, requireUser } from "@/lib/session";
import { ensureInspectionTemplates } from "@/lib/inspectionTemplates";
import { createInspectionTemplate } from "./actions";

export const dynamic = "force-dynamic";

export default async function InspectionTemplatesPage() {
  const user = await requireUser();
  if (user.accountType !== "AUTO_SHOP") notFound();
  const orgId = await requireOrgId();
  const templates = await ensureInspectionTemplates(orgId);
  return (
    <>
      <PageHeader title="Inspection templates" description="Reusable checklists for your technicians." />
      <div className="max-w-3xl space-y-4">
        <Card>
          <CardHeader title="Templates" />
          <div className="divide-y divide-zinc-200">
            {templates.map((template) => (
              <Link key={template.id} href={`/settings/inspections/${template.id}`} className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-zinc-50">
                <div>
                  <div className="font-medium text-zinc-900">{template.name}</div>
                  <div className="text-xs text-zinc-500">{template.items.length} item{template.items.length === 1 ? "" : "s"}</div>
                </div>
                <span className="text-sm text-[var(--vx-accent-600)]">Edit →</span>
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Create a template" />
          <form action={createInspectionTemplate} className="flex flex-wrap items-end gap-3 p-4">
            <label className="flex-1 text-sm font-medium text-zinc-700">
              Template name
              <Input name="name" required placeholder="e.g. Pre-delivery inspection" className="mt-1" />
            </label>
            <button type="submit" className="h-9 rounded-md bg-[var(--vx-accent-600)] px-4 text-sm font-medium text-white hover:bg-[var(--vx-accent-700)]">Create template</button>
          </form>
        </Card>
      </div>
    </>
  );
}
