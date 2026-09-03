import { redirect } from "next/navigation";
import VultrixLanding from "@/components/marketing/VultrixLanding";
import { TRIAL_DAYS } from "@/lib/billing";
import { getCurrentUser } from "@/lib/session";
import { getLandingConfig } from "@/lib/landing";
import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ customize?: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();
  if (!user) return <VultrixLanding trialDays={TRIAL_DAYS} config={await getLandingConfig()} />;
  if (!user.orgId) redirect("/admin");
  return <Dashboard user={user} searchParams={searchParams} />;
}
