import type { FeatureKey } from "@/lib/features";

export type DashboardBlockId =
  | "today"
  | "counts"
  | "stats"
  | "goals"
  | "schedule"
  | "notes"
  | "spending"
  | "top_products"
  | "low_stock"
  | "quick_add"
  | "vehicles_due"
  | "tech_hours"
  | "outstanding"
  | "recent_records";

export type DashboardLayout = {
  columns: 1 | 2;
  blocks: Array<{
    id: DashboardBlockId;
    visible: boolean;
  }>;
};

export const DASHBOARD_BLOCKS: Array<{
  id: DashboardBlockId;
  label: string;
  hint: string;
  defaultVisible: boolean;
  requires: FeatureKey[];
  wide?: boolean;
}> = [
  {
    id: "today",
    label: "Today",
    hint: "Routines, reminders, and goals that need attention today.",
    defaultVisible: true,
    requires: [],
  },
  {
    id: "counts",
    label: "Account summary",
    hint: "Customers, vehicles, open work, and money at a glance.",
    defaultVisible: true,
    requires: [],
    wide: true,
  },
  {
    id: "stats",
    label: "Money summary",
    hint: "Money in, money out, and your monthly net.",
    defaultVisible: true,
    requires: ["financials"],
  },
  {
    id: "goals",
    label: "Goals",
    hint: "Your active goals and current progress.",
    defaultVisible: true,
    requires: [],
  },
  {
    id: "schedule",
    label: "Today's schedule",
    hint: "Today's events and what is coming up this week.",
    defaultVisible: true,
    requires: ["schedule"],
  },
  {
    id: "notes",
    label: "Recent notes",
    hint: "Your latest notes and quick access to capture another.",
    defaultVisible: true,
    requires: ["knowledge"],
  },
  {
    id: "quick_add",
    label: "Quick actions",
    hint: "Shortcuts for adding notes, events, money, and goals.",
    defaultVisible: false,
    requires: [],
  },
  {
    id: "spending",
    label: "Spending this month",
    hint: "The categories where you have spent the most this month.",
    defaultVisible: false,
    requires: ["financials"],
  },
  {
    id: "top_products",
    label: "Best sellers this month",
    hint: "Your top-selling products and their revenue this month.",
    defaultVisible: false,
    requires: ["financials"],
  },
  {
    id: "low_stock",
    label: "Low stock",
    hint: "Inventory items at or below their reorder level.",
    defaultVisible: false,
    requires: ["inventory"],
  },
  {
    id: "vehicles_due",
    label: "Vehicles due for service",
    hint: "Vehicles with overdue maintenance items.",
    defaultVisible: true,
    requires: ["reminders"],
  },
  {
    id: "tech_hours",
    label: "Hours logged this week",
    hint: "Technician time recorded this week.",
    defaultVisible: true,
    requires: ["technicians"],
    wide: true,
  },
  {
    id: "outstanding",
    label: "Outstanding invoices",
    hint: "Invoices that still have a balance due.",
    defaultVisible: true,
    requires: ["invoices"],
    wide: true,
  },
  {
    id: "recent_records",
    label: "Recent records",
    hint: "The latest repair orders or invoices.",
    defaultVisible: true,
    requires: [],
    wide: true,
  },
];

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  columns: 1,
  blocks: [
    { id: "today", visible: true },
    { id: "counts", visible: true },
    { id: "stats", visible: true },
    { id: "goals", visible: true },
    { id: "schedule", visible: true },
    { id: "notes", visible: true },
    { id: "quick_add", visible: false },
    { id: "spending", visible: false },
    { id: "top_products", visible: false },
    { id: "vehicles_due", visible: true },
    { id: "low_stock", visible: false },
    { id: "tech_hours", visible: true },
    { id: "outstanding", visible: true },
    { id: "recent_records", visible: true },
  ],
};

function parsedLayout(raw: unknown): { columns: 1 | 2; blocks: unknown[] } {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  if (!value || typeof value !== "object") {
    return { columns: 1, blocks: [] };
  }
  const record = value as Record<string, unknown>;
  const rawColumns = record.columns;
  return {
    columns:
      (typeof rawColumns === "number" || typeof rawColumns === "string") &&
      Number(rawColumns) === 2
        ? 2
        : 1,
    blocks: Array.isArray(record.blocks) ? record.blocks : [],
  };
}

function defaultVisibleFor(
  block: (typeof DASHBOARD_BLOCKS)[number],
  accountType?: string | null,
): boolean {
  if (block.id === "low_stock" && accountType !== "PERSONAL") return true;
  return block.defaultVisible;
}

export function normalizeDashboardLayout(
  raw: unknown,
  accountType?: string | null,
): DashboardLayout {
  const parsed = parsedLayout(raw);
  const known = new Set(DASHBOARD_BLOCKS.map((block) => block.id));
  const blocks: DashboardLayout["blocks"] = [];
  const seen = new Set<DashboardBlockId>();

  for (const rawBlock of parsed.blocks) {
    if (!rawBlock || typeof rawBlock !== "object") continue;
    const record = rawBlock as Record<string, unknown>;
    const id = record.id;
    if (typeof id !== "string" || !known.has(id as DashboardBlockId)) continue;
    const blockId = id as DashboardBlockId;
    if (seen.has(blockId)) continue;
    seen.add(blockId);
    blocks.push({ id: blockId, visible: record.visible === true });
  }

  if (blocks.length === 0) {
    return {
      columns: parsed.columns,
      blocks: DASHBOARD_BLOCKS.map((block) => ({
        id: block.id,
        visible: defaultVisibleFor(block, accountType),
      })),
    };
  }

  for (const block of DASHBOARD_BLOCKS) {
    if (!seen.has(block.id)) {
      blocks.push({
        id: block.id,
        visible: defaultVisibleFor(block, accountType),
      });
    }
  }

  return { columns: parsed.columns, blocks };
}

export function resolveDashboardLayout(
  userLayout: unknown,
  orgDefault: unknown,
  accountType?: string | null,
): DashboardLayout {
  return normalizeDashboardLayout(
    userLayout === null || userLayout === undefined ? orgDefault : userLayout,
    accountType,
  );
}

export function serializeDashboardLayout(layout: DashboardLayout): string {
  return JSON.stringify(layout);
}
