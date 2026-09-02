import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return children;
}
