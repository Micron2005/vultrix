import { db } from "@/lib/db";

type DefaultSection = { section: string; items: string[] };
export type DefaultInspectionTemplate = { name: string; sections: DefaultSection[] };

export const DEFAULT_INSPECTION_TEMPLATES: DefaultInspectionTemplate[] = [
  {
    name: "Multi-point inspection",
    sections: [
      { section: "Under hood", items: ["Engine oil level/condition", "Coolant", "Brake fluid", "Power steering fluid", "Belts", "Hoses", "Battery & terminals", "Air filter", "Cabin filter"] },
      { section: "Exterior", items: ["Headlights", "Tail/brake lights", "Turn signals", "Wipers & washer", "Windshield", "Mirrors"] },
      { section: "Tires", items: ["LF tread/pressure", "RF tread/pressure", "LR tread/pressure", "RR tread/pressure", "Spare"] },
      { section: "Brakes", items: ["Front pads", "Rear pads/shoes", "Rotors/drums", "Brake lines"] },
      { section: "Under vehicle", items: ["Exhaust", "Shocks/struts", "CV boots/axles", "Steering linkage", "Fluid leaks"] },
      { section: "Interior", items: ["Horn", "HVAC", "Warning lights", "Seat belts"] },
    ],
  },
  {
    name: "Brake inspection",
    sections: [
      { section: "Brakes", items: ["Front pads (mm)", "Rear pads/shoes", "Front rotors", "Rear rotors/drums", "Calipers", "Brake lines & hoses", "Brake fluid", "Parking brake", "Wheel bearings"] },
    ],
  },
  {
    name: "Tire & alignment check",
    sections: [
      { section: "Tires", items: ["LF tread depth", "RF tread depth", "LR tread depth", "RR tread depth", "Tire pressure all four", "Uneven wear"] },
      { section: "Alignment", items: ["Steering wheel centered", "Pulls left/right", "Tie rods", "Ball joints"] },
    ],
  },
];

export async function ensureInspectionTemplates(orgId: string) {
  const count = await db.inspectionTemplate.count({ where: { orgId } });
  if (count > 0) {
    return db.inspectionTemplate.findMany({
      where: { orgId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  }
  for (const [sortOrder, template] of DEFAULT_INSPECTION_TEMPLATES.entries()) {
    let itemSortOrder = 0;
    await db.inspectionTemplate.create({
      data: {
        orgId,
        name: template.name,
        sortOrder,
        items: {
          create: template.sections.flatMap(({ section, items }) =>
            items.map((name) => ({
              section,
              name,
              sortOrder: itemSortOrder++,
            })),
          ),
        },
      },
    });
  }
  return db.inspectionTemplate.findMany({
    where: { orgId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
}
