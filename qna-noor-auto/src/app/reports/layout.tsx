import { requireFinancialAccess } from "@/lib/permissions";

export default async function ReportsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireFinancialAccess();
  return children;
}
