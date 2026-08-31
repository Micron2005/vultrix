import { requireFinancialAccess } from "@/lib/permissions";

export default async function ExportLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireFinancialAccess();
  return children;
}
