import { redirect } from "next/navigation";
import VultrixLanding from "@/components/marketing/VultrixLanding";
import { TRIAL_DAYS } from "@/lib/billing";
import { getCurrentUser } from "@/lib/session";
import { DashboardPersonal } from "./DashboardPersonal";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ customize?: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <VultrixLanding trialDays={TRIAL_DAYS} />;
  if (!user.orgId) redirect("/admin");
  return <DashboardPersonal user={user} searchParams={searchParams} />;
}
