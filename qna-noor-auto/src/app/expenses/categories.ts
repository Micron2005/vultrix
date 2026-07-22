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

export function prettyCategory(c: string): string {
  const map: Record<string, string> = {
    RENT: "Rent",
    UTILITIES: "Utilities",
    SUPPLIES: "Shop supplies",
    TOOLS: "Tools",
    VEHICLE: "Shop vehicle",
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
  };
  return map[frequency] ?? frequency;
}
