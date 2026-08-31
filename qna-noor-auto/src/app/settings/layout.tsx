import { requireSettingsAccess } from "@/lib/permissions";

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireSettingsAccess();
  return children;
}
