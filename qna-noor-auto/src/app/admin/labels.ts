export function accountTypeLabel(accountType: string): string {
  if (accountType === "PERSONAL") return "Personal";
  if (accountType === "BUSINESS") return "Business";
  return "Auto shop";
}
