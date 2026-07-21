export const FEATURES = [
  { key: "repair_orders", label: "Repair orders", autoOnly: true },
  { key: "vehicles", label: "Vehicles", autoOnly: true },
  { key: "lookup", label: "Lookup", autoOnly: true },
  { key: "reminders", label: "Reminders", autoOnly: true },
  { key: "technicians", label: "Technicians", autoOnly: true },
  { key: "presets", label: "Presets", autoOnly: true },
  { key: "customers", label: "Customers", autoOnly: false },
  { key: "inventory", label: "Inventory", autoOnly: false },
  { key: "invoices", label: "Invoices", autoOnly: false },
  { key: "financials", label: "Financials", autoOnly: false },
  { key: "reports", label: "Reports", autoOnly: false },
  { key: "schedule", label: "Schedule", autoOnly: false },
  { key: "knowledge", label: "Knowledge", autoOnly: false },
  { key: "import_export", label: "Import / export", autoOnly: false },
] as const;

export type FeatureKey = (typeof FEATURES)[number]["key"];

const ALL_FEATURE_KEYS = FEATURES.map((feature) => feature.key);

export const DEFAULT_GENERAL_FEATURES: FeatureKey[] = [
  "customers",
  "invoices",
  "financials",
  "reports",
];

export function enabledFeatureSet(org: {
  accountType?: string | null;
  features?: string[] | null;
}): Set<FeatureKey> {
  if ((org.accountType ?? "AUTO_SHOP") === "AUTO_SHOP") {
    return new Set(ALL_FEATURE_KEYS);
  }

  const generalKeys = new Set<string>(
    FEATURES.filter((feature) => !feature.autoOnly).map((feature) => feature.key),
  );
  const enabled = (org.features ?? []).filter((key): key is FeatureKey =>
    generalKeys.has(key as FeatureKey),
  );
  return new Set(enabled);
}
