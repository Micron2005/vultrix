import { db } from "./db";

export async function createInspectionFromTemplate(
  orgId: string,
  repairOrderId: string,
  templateId: string,
): Promise<string> {
  const ro = await db.repairOrder.findFirst({
    where: { id: repairOrderId, orgId },
    select: { id: true },
  });
  if (!ro) throw new Error("Repair order not found");

  const template = await db.inspectionTemplate.findFirst({
    where: { id: templateId, orgId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) throw new Error("Inspection template not found");

  const inspection = await db.inspection.create({
    data: {
      orgId,
      repairOrderId,
      templateName: template.name,
      items: {
        create: template.items.map((item) => ({
          section: item.section,
          name: item.name,
          sortOrder: item.sortOrder,
        })),
      },
    },
  });
  return inspection.id;
}
