export const EXPENSE_CATEGORIES = [
  "RENT",
  "UTILITIES",
  "SUPPLIES",
  "TOOLS",
  "VEHICLE",
  "INSURANCE",
  "SOFTWARE",
  "MISC",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_METHODS = [
  "CASH",
  "CARD",
  "CHECK",
  "TRANSFER",
  "OTHER",
] as const;

export const INCOME_FREQUENCIES = [
  "ONE_TIME",
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
] as const;

export type IncomeFrequency = (typeof INCOME_FREQUENCIES)[number];

export const REPEAT_OPTIONS = [
  { value: "ONE_TIME", label: "One time" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Every 2 weeks" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
] as const;

export function prettyInterval(interval: string): string {
  return (
    REPEAT_OPTIONS.find((option) => option.value === interval)?.label ??
    interval
  );
}

export function repeatDescription(interval: string): string {
  const map: Record<string, string> = {
    DAILY: "every day",
    WEEKLY: "every week",
    BIWEEKLY: "every 2 weeks",
    MONTHLY: "every month",
    YEARLY: "every year",
  };
  return map[interval] ?? prettyInterval(interval);
}

export function prettyCategory(c: string): string {
  const map: Record<string, string> = {
    RENT: "Rent",
    UTILITIES: "Utilities",
    SUPPLIES: "Supplies",
    TOOLS: "Tools",
    VEHICLE: "Vehicle",
    INSURANCE: "Insurance",
    SOFTWARE: "Software",
    MISC: "Other",
  };
  return map[c] ?? c;
}

export function prettyMethod(m: string | null): string {
  if (!m) return "—";
  const map: Record<string, string> = {
    CASH: "Cash",
    CARD: "Card",
    CHECK: "Check",
    TRANSFER: "Transfer",
    OTHER: "Other",
  };
  return map[m] ?? m;
}

export function prettyFrequency(frequency: string): string {
  const map: Record<string, string> = {
    ONE_TIME: "One time",
    WEEKLY: "Weekly",
    BIWEEKLY: "Every two weeks",
    MONTHLY: "Monthly",
    DAILY: "Daily",
    YEARLY: "Yearly",
  };
  return map[frequency] ?? frequency;
}
