import { enabledFeatureSet } from "@/lib/features";
import { getCurrentUser } from "@/lib/session";
import { ImportPageClient } from "./ImportPageClient";
import type { ImportType } from "./fields";

export default async function ImportPage() {
  const user = await getCurrentUser();
  const features = enabledFeatureSet(user ?? {});
  const availableTypes: { id: ImportType; label: string }[] = [
    ...(features.has("customers")
      ? [{ id: "customers" as const, label: "Customers & vehicles" }]
      : []),
    ...(features.has("financials")
      ? [{ id: "money" as const, label: "Income & expenses" }]
      : []),
    ...(features.has("schedule")
      ? [{ id: "calendar" as const, label: "Calendar events" }]
      : []),
  ];
  const showIdentifixImport =
    (user?.accountType ?? "AUTO_SHOP") === "AUTO_SHOP" ||
    features.has("repair_orders");

  return (
    <ImportPageClient
      availableTypes={availableTypes}
      showIdentifixImport={showIdentifixImport}
    />
  );
}
