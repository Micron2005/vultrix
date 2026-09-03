import type { FeatureKey } from "@/lib/features";
import type { CurrentUser } from "@/lib/session";

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
  columns: 1 | 2 | 3;
  density: DashboardDensity;
  greeting: {
    show: boolean;
    text: string | null;
  };
  blocks: Array<{
    id: DashboardBlockId;
    visible: boolean;
    size: DashboardBlockSize;
    collapsed: boolean;
    title: string | null;
    options: Record<string, string>;
  }>;
};

export type DashboardDensity = "comfortable" | "compact";
export type DashboardBlockSize = "normal" | "wide";
export type DashboardBlockDefinition = {
  id: DashboardBlockId;
  label: string;
  hint: string;
  defaultVisible: boolean;
  defaultVisiblePersonal?: boolean;
  requires: FeatureKey[];
  wide?: boolean;
  settings?: Array<{
    key: string;
    label: string;
    choices: Array<{ value: string; label: string }>;
    default: string;
  }>;
};

export const DASHBOARD_BLOCKS: DashboardBlockDefinition[] = [
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
    settings: [
      {
        key: "period",
        label: "Period",
        choices: [
          { value: "month", label: "This month" },
          { value: "30d", label: "Last 30 days" },
          { value: "year", label: "This year" },
        ],
        default: "month",
      },
    ],
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
    settings: [
      {
        key: "window",
        label: "Window",
        choices: [
          { value: "today", label: "Today" },
          { value: "week", label: "Next 7 days" },
        ],
        default: "today",
      },
    ],
  },
  {
    id: "notes",
    label: "Recent notes",
    hint: "Your latest notes and quick access to capture another.",
    defaultVisible: true,
    requires: ["knowledge"],
    settings: [
      {
        key: "count",
        label: "Notes",
        choices: [
          { value: "3", label: "3" },
          { value: "5", label: "5" },
          { value: "10", label: "10" },
        ],
        default: "5",
      },
    ],
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
    id: "vehicles_due",
    label: "Vehicles due for service",
    hint: "Vehicles with overdue maintenance items.",
    defaultVisible: true,
    requires: ["reminders"],
  },
  {
    id: "low_stock",
    label: "Low stock",
    hint: "Inventory items at or below their reorder level.",
    defaultVisible: true,
    defaultVisiblePersonal: false,
    requires: ["inventory"],
    settings: [
      {
        key: "limit",
        label: "Show",
        choices: [
          { value: "5", label: "5" },
          { value: "10", label: "10" },
          { value: "all", label: "All" },
        ],
        default: "10",
      },
    ],
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
    settings: [
      {
        key: "count",
        label: "Records",
        choices: [
          { value: "5", label: "5" },
          { value: "8", label: "8" },
          { value: "10", label: "10" },
          { value: "20", label: "20" },
        ],
        default: "8",
      },
    ],
  },
];

function parsedLayout(raw: unknown): {
  columns: DashboardLayout["columns"];
  density: unknown;
  greeting: unknown;
  blocks: unknown[];
} {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  if (!value || typeof value !== "object") {
    return { columns: 1, density: undefined, greeting: undefined, blocks: [] };
  }
  const record = value as Record<string, unknown>;
  const rawColumns = record.columns;
  const numericColumns = Number(rawColumns);
  return {
    columns:
      numericColumns === 1 || numericColumns === 2 || numericColumns === 3
        ? numericColumns
        : 1,
    density: record.density,
    greeting: record.greeting,
    blocks: Array.isArray(record.blocks) ? record.blocks : [],
  };
}

function defaultVisibleFor(
  block: (typeof DASHBOARD_BLOCKS)[number],
  accountType: CurrentUser["accountType"],
): boolean {
  return accountType === "PERSONAL"
    ? (block.defaultVisiblePersonal ?? block.defaultVisible)
    : block.defaultVisible;
}

export function normalizeDashboardLayout(
  raw: unknown,
  accountType: CurrentUser["accountType"],
): DashboardLayout {
  const parsed = parsedLayout(raw);
  const known = new Set(DASHBOARD_BLOCKS.map((block) => block.id));
  const definitionById = new Map(DASHBOARD_BLOCKS.map((block) => [block.id, block]));
  const blocks: DashboardLayout["blocks"] = [];
  const seen = new Set<DashboardBlockId>();
  const density: DashboardDensity =
    parsed.density === "compact" ? "compact" : "comfortable";
  const rawGreeting =
    parsed.greeting && typeof parsed.greeting === "object"
      ? (parsed.greeting as Record<string, unknown>)
      : {};
  const greetingText =
    typeof rawGreeting.text === "string"
      ? rawGreeting.text.trim() || null
      : null;
  const greeting = {
    show: rawGreeting.show !== false,
    text: greetingText,
  };

  const normalizedBlock = (
    blockId: DashboardBlockId,
    record?: Record<string, unknown>,
  ): DashboardLayout["blocks"][number] => {
    const definition = definitionById.get(blockId);
    const rawOptions =
      record?.options && typeof record.options === "object"
        ? (record.options as Record<string, unknown>)
        : {};
    const options = Object.fromEntries(
      (definition?.settings ?? []).map((setting) => {
        const value = rawOptions[setting.key];
        const valid = setting.choices.some((choice) => choice.value === value);
        return [setting.key, valid ? String(value) : setting.default];
      }),
    );
    const rawTitle = typeof record?.title === "string" ? record.title.trim() : "";
    const rawSize = record?.size;
    return {
      id: blockId,
      visible: record?.visible === true,
      size:
        rawSize === "normal" || rawSize === "wide"
          ? rawSize
          : definition?.wide
            ? "wide"
            : "normal",
      collapsed: record?.collapsed === true,
      title: rawTitle ? rawTitle.slice(0, 40) : null,
      options,
    };
  };

  for (const rawBlock of parsed.blocks) {
    if (!rawBlock || typeof rawBlock !== "object") continue;
    const record = rawBlock as Record<string, unknown>;
    const id = record.id;
    if (typeof id !== "string" || !known.has(id as DashboardBlockId)) continue;
    const blockId = id as DashboardBlockId;
    if (seen.has(blockId)) continue;
    seen.add(blockId);
    blocks.push(normalizedBlock(blockId, record));
  }

  if (blocks.length === 0) {
    return {
      columns: parsed.columns,
      density,
      greeting,
      blocks: DASHBOARD_BLOCKS.map((block) => ({
        ...normalizedBlock(block.id),
        visible: defaultVisibleFor(block, accountType),
      })),
    };
  }

  for (const block of DASHBOARD_BLOCKS) {
    if (!seen.has(block.id)) {
      blocks.push({
        ...normalizedBlock(block.id),
        visible: defaultVisibleFor(block, accountType),
      });
    }
  }

  return { columns: parsed.columns, density, greeting, blocks };
}

export function resolveDashboardLayout(
  userLayout: unknown,
  orgDefault: unknown,
  accountType: CurrentUser["accountType"],
): DashboardLayout {
  return normalizeDashboardLayout(
    userLayout === null || userLayout === undefined ? orgDefault : userLayout,
    accountType,
  );
}

export function serializeDashboardLayout(layout: DashboardLayout): string {
  return JSON.stringify(layout);
}
