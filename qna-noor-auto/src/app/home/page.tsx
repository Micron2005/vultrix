import VultrixLanding from "@/components/marketing/VultrixLanding";
import { TRIAL_DAYS } from "@/lib/billing";
import { getLandingConfig } from "@/lib/landing";

// Public marketing landing page at a stable path. Unlike "/", this always
// renders the landing regardless of auth, so signed-in users can revisit the
// marketing site (and people who just signed out land here). The root layout
// renders it full-bleed (no app sidebar) for everyone.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  return <VultrixLanding trialDays={TRIAL_DAYS} config={await getLandingConfig()} />;
}
