import { requireFinancialAccess } from "@/lib/permissions";

export default async function ExpensesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireFinancialAccess();
  return children;
}
