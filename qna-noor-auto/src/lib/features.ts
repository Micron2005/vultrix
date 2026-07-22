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

// General features every non-auto account always gets, regardless of what they
// pick during sign-up. Import / export is a baseline capability so anyone can
// bring their own data in or take it out — it can't be turned off.
export const MANDATORY_GENERAL_FEATURES: FeatureKey[] = ["import_export"];

export function mandatoryFeaturesFor(accountType?: string | null): FeatureKey[] {
  return accountType === "PERSONAL"
    ? [...MANDATORY_GENERAL_FEATURES, "schedule"]
    : [...MANDATORY_GENERAL_FEATURES];
}

export const DEFAULT_GENERAL_FEATURES: FeatureKey[] = [
  "customers",
  "invoices",
  "financials",
  "reports",
  "import_export",
];

export function repairOrderNouns(accountType?: string | null): {
  singular: string;
  plural: string;
} {
  return (accountType ?? "AUTO_SHOP") === "AUTO_SHOP"
    ? { singular: "Repair Order", plural: "Repair Orders" }
    : { singular: "Invoice", plural: "Invoices" };
}

export function sanitizeFeatureKeys(
  accountType: string | null | undefined,
  keys: string[] | null | undefined,
): FeatureKey[] {
  if ((accountType ?? "AUTO_SHOP") === "AUTO_SHOP") {
    return [...ALL_FEATURE_KEYS];
  }

  const generalKeys = new Set<string>(
    FEATURES.filter((feature) => !feature.autoOnly).map((feature) => feature.key),
  );
  const selected = new Set(
    (keys ?? []).filter((key): key is FeatureKey => generalKeys.has(key)),
  );
  for (const key of mandatoryFeaturesFor(accountType)) selected.add(key);
  return Array.from(selected);
}

export function enabledFeatureSet(org: {
  accountType?: string | null;
  features?: string[] | null;
}): Set<FeatureKey> {
  if ((org.accountType ?? "AUTO_SHOP") === "AUTO_SHOP") {
    return new Set(ALL_FEATURE_KEYS);
  }

  return new Set(sanitizeFeatureKeys(org.accountType, org.features));
}
