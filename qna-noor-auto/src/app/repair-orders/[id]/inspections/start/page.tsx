import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { createInspectionFromTemplate } from "@/lib/inspections";

export const dynamic = "force-dynamic";

export default async function StartInspectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ templateId?: string }>;
}) {
  const { id } = await params;
  const { templateId } = await searchParams;
  const next = `/repair-orders/${id}/inspections/start?templateId=${encodeURIComponent(templateId ?? "")}`;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (user.accountType !== "AUTO_SHOP" || !user.orgId) {
    redirect("/");
  }

  const ro = await db.repairOrder.findFirst({
    where: { id, orgId: user.orgId },
    select: { id: true },
  });
  if (!ro) notFound();
  if (!templateId) {
    redirect(`/repair-orders/${id}`);
  }

  let inspectionId: string;
  try {
    inspectionId = await createInspectionFromTemplate(
      user.orgId,
      id,
      templateId,
    );
  } catch {
    redirect(`/repair-orders/${id}`);
  }
  revalidatePath(`/repair-orders/${id}`);
  redirect(`/repair-orders/${id}/inspections/${inspectionId}`);
}
