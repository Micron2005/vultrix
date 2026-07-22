import { APP_NAME, APP_OWNER_LINE } from "@/lib/branding";
import {
  GENERAL_PRICE_USD,
  PERSONAL_BASIC_PRICE_USD,
  PERSONAL_AI_ADDON_USD,
  PRICE_USD,
  TRIAL_DAYS,
} from "@/lib/billing";
import { billingConfigured } from "@/lib/stripe";
import { SignupWizard } from "./SignupWizard";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string; canceled?: string }>;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, canceled } = await searchParams;
  const available = billingConfigured();

  if (!available) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 p-4">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center">
            <div className="text-2xl font-bold tracking-tight text-zinc-900">
              {APP_NAME}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Sign-up isn&apos;t available yet. Please check back soon.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SignupWizard
      brand={APP_NAME}
      ownerLine={APP_OWNER_LINE}
      autoPrice={PRICE_USD}
      generalPrice={GENERAL_PRICE_USD}
      personalBasicPrice={PERSONAL_BASIC_PRICE_USD}
      personalAiAddonPrice={PERSONAL_AI_ADDON_USD}
      trialDays={TRIAL_DAYS}
      error={error}
      canceled={canceled}
    />
  );
}
