import { requireSuperadmin } from "@/lib/session";
import { getLandingConfig } from "@/lib/landing";
import { TRIAL_DAYS } from "@/lib/billing";
import VultrixLanding from "@/components/marketing/VultrixLanding";

export const dynamic = "force-dynamic";

export default async function LandingPreviewPage() {
  await requireSuperadmin();
  const config = await getLandingConfig();
  return <VultrixLanding trialDays={TRIAL_DAYS} config={config} />;
}
