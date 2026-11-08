export type FirstResultKind = "invoice" | "routine";

export type FirstResultState = {
  kind: FirstResultKind;
  done: boolean;
  showBanner: boolean;
};

export function firstResultState(input: {
  accountType: string | null | undefined;
  features: readonly string[];
  repairOrderCount: number;
  checkOffCount: number;
  dismissed: boolean;
  role: string;
}): FirstResultState | null {
  if (input.role !== "OWNER" && input.role !== "ADMIN") return null;

  const kind =
    input.accountType === "BUSINESS" && input.features.includes("invoices")
      ? "invoice"
      : input.accountType === "PERSONAL"
        ? "routine"
        : null;
  if (!kind) return null;

  const done =
    kind === "invoice"
      ? input.repairOrderCount > 0
      : input.checkOffCount > 0 || input.dismissed;

  return {
    kind,
    done,
    showBanner: !input.dismissed && !done,
  };
}
