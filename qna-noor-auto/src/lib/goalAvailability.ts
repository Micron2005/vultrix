export type GoalAvailabilityContext = {
  accountType?: string | null;
  features: Iterable<string>;
};

export function metricAllowed(
  metric: string,
  { accountType, features }: GoalAvailabilityContext,
): boolean {
  const featureSet = new Set(features);
  const autoShop = (accountType ?? "AUTO_SHOP") === "AUTO_SHOP";
  const hasInvoices = featureSet.has("invoices");
  const hasFinancials = featureSet.has("financials");

  if (["MONEY_IN", "SPENDING", "PROFIT", "NET_SAVED"].includes(metric)) {
    return hasFinancials;
  }
  if (metric === "JOBS") return autoShop && hasInvoices;
  if (metric === "UNITS_SOLD") return !hasInvoices && hasFinancials;
  if (metric === "EVENTS") return featureSet.has("schedule");
  if (metric === "NOTES_WRITTEN") return featureSet.has("knowledge");
  return ["LOGGED_TOTAL", "LOGGED_LATEST", "MANUAL"].includes(metric);
}
