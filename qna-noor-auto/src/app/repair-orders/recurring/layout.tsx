import { redirect } from "next/navigation";
import { enabledFeatureSet } from "@/lib/features";
import { requireUser } from "@/lib/session";
import { canViewFinancials } from "@/lib/permissions";

export default async function RecurringInvoicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!canViewFinancials(user.role) || !enabledFeatureSet(user).has("invoices")) {
    redirect("/repair-orders");
  }
  return children;
}
