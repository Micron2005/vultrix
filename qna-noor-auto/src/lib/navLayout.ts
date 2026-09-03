import type { FeatureKey } from "@/lib/features";

export type NavCatalogItem = {
  href: string;
  label: string;
  feature?: FeatureKey;
  required?: boolean;
};

export type NavMode = "sidebar" | "top";
export type NavUtilityPlacement = "top" | "bottom";

export type NavLayout = {
  mode: NavMode;
  utilities: NavUtilityPlacement;
  items: Array<{ href: string; visible: boolean; label?: string }>;
};

type NavLabelOptions = {
  accountType?: string | null;
  enabledFeatures: Iterable<string>;
};

export const NAV_ITEMS: NavCatalogItem[] = [
  { href: "/", label: "Dashboard", required: true },
  { href: "/customers", label: "Customers", feature: "customers" },
  { href: "/businesses", label: "Businesses", feature: "customers" },
  { href: "/vehicles", label: "Vehicles", feature: "vehicles" },
  { href: "/vehicle-search", label: "Lookup", feature: "lookup" },
  { href: "/repair-orders", label: "Repair Orders", feature: "repair_orders" },
  { href: "/appointments", label: "Schedule", feature: "schedule" },
  { href: "/reminders", label: "Reminders", feature: "reminders" },
  { href: "/notes", label: "Knowledge", feature: "knowledge" },
  { href: "/technicians", label: "Technicians", feature: "technicians" },
  { href: "/inventory", label: "Inventory", feature: "inventory" },
  { href: "/canned-jobs", label: "Presets", feature: "presets" },
  { href: "/expenses", label: "Financials", feature: "financials" },
  { href: "/goals", label: "Goals" },
  { href: "/sales", label: "Sales", feature: "financials" },
  { href: "/reports", label: "Reports", feature: "reports" },
  { href: "/import", label: "Import", feature: "import_export" },
  { href: "/export", label: "Export", feature: "import_export" },
  { href: "/settings", label: "Settings", required: true },
  { href: "/settings/users", label: "Logins" },
  { href: "/billing", label: "Billing" },
  { href: "/assistant", label: "Assistant" },
];

type NavEligibilityOptions = {
  enabledFeatures: Iterable<string>;
  accountType?: string | null;
  canViewFinancials: boolean;
  canManageUsers: boolean;
  aiAssistantEnabled: boolean;
};

const STAFF_HIDDEN_HREFS = new Set([
  "/expenses",
  "/sales",
  "/reports",
  "/export",
  "/settings",
]);

export function getEligibleNavItems({
  enabledFeatures,
  canViewFinancials,
  canManageUsers,
  aiAssistantEnabled,
}: NavEligibilityOptions): NavCatalogItem[] {
  const features = new Set(enabledFeatures);

  return NAV_ITEMS.filter((item) => {
    if (item.href === "/settings/users" || item.href === "/billing") {
      return canManageUsers;
    }
    if (item.href === "/assistant") return aiAssistantEnabled;
    if (
      item.href === "/repair-orders" &&
      !features.has("repair_orders") &&
      !features.has("invoices")
    ) {
      return false;
    }
    if (item.feature && !features.has(item.feature)) return false;
    if (!canViewFinancials && STAFF_HIDDEN_HREFS.has(item.href)) return false;
    if (item.href === "/sales" && features.has("invoices")) return false;
    return true;
  });
}

export function navItemLabel(
  item: NavCatalogItem,
  { accountType, enabledFeatures }: NavLabelOptions,
): string {
  if (item.href === "/appointments") {
    return accountType === "PERSONAL" ? "Calendar" : "Schedule";
  }
  if (item.href !== "/repair-orders") return item.label;
  const features = new Set(enabledFeatures);
  const hasRepairOrders = features.has("repair_orders");
  return hasRepairOrders || (accountType ?? "AUTO_SHOP") === "AUTO_SHOP"
    ? "Repair Orders"
    : "Invoices";
}

function parseNavLayout(raw: unknown): unknown[] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return Array.isArray(record.items) ? record.items : [];
}

function parseNavSettings(raw: unknown): {
  mode: NavMode;
  utilities: NavUtilityPlacement;
} {
  if (!raw || typeof raw !== "object") {
    return { mode: "sidebar", utilities: "top" };
  }
  const record = raw as Record<string, unknown>;
  return {
    mode: record.mode === "top" ? "top" : "sidebar",
    utilities: record.utilities === "bottom" ? "bottom" : "top",
  };
}

export function normalizeNavLayout(
  raw: unknown,
  options: NavLabelOptions,
): NavLayout {
  const known = new Map(NAV_ITEMS.map((item) => [item.href, item]));
  const items: NavLayout["items"] = [];
  const seen = new Set<string>();

  for (const rawItem of parseNavLayout(raw)) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const record = rawItem as Record<string, unknown>;
    const href = record.href;
    if (typeof href !== "string" || !known.has(href) || seen.has(href)) {
      continue;
    }
    seen.add(href);
    const catalogItem = known.get(href);
    if (!catalogItem) continue;
    const defaultLabel = navItemLabel(catalogItem, options);
    const label =
      typeof record.label === "string"
        ? record.label.trim().slice(0, 24)
        : "";
    items.push({
      href,
      visible: catalogItem?.required ? true : record.visible === true,
      ...(label && label !== defaultLabel ? { label } : {}),
    });
  }

  for (const catalogItem of NAV_ITEMS) {
    if (!seen.has(catalogItem.href)) {
      items.push({ href: catalogItem.href, visible: true });
    }
  }

  const settings = parseNavSettings(
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        })()
      : raw,
  );
  return { ...settings, items };
}

export function resolveNavLayout(
  userLayout: unknown,
  orgDefault: unknown,
  options: NavLabelOptions,
): NavLayout {
  return normalizeNavLayout(
    userLayout === null || userLayout === undefined ? orgDefault : userLayout,
    options,
  );
}

export function serializeNavLayout(layout: NavLayout): string {
  return JSON.stringify(layout);
}
