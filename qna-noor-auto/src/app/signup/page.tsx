import Link from "next/link";
import { APP_NAME, APP_OWNER_LINE } from "@/lib/branding";
import { PRICE_USD, TRIAL_DAYS } from "@/lib/billing";
import { billingConfigured } from "@/lib/stripe";
import { startSignup } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string; canceled?: string }>;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, canceled } = await searchParams;
  const available = billingConfigured();

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-2xl font-bold tracking-tight text-zinc-900">
            {APP_NAME}
          </div>
          <div className="text-xs text-zinc-500">
            Start your shop — ${PRICE_USD}/month
            {TRIAL_DAYS > 0 ? `, ${TRIAL_DAYS}-day free trial` : ""}
          </div>
        </div>
        <div className="rounded-lg bg-white shadow-sm border border-zinc-200 p-6">
          {!available ? (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              Sign-up isn&apos;t available yet. Please check back soon.
            </div>
          ) : (
            <form action={startSignup} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-zinc-700">
                  Business name
                </span>
                <input
                  type="text"
                  name="name"
                  required
                  autoFocus
                  placeholder="e.g. Drive Nation Auto"
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-zinc-700">
                  Billing email
                </span>
                <input
                  type="email"
                  name="email"
                  required
                  autoCapitalize="none"
                  autoComplete="email"
                  placeholder="you@yourshop.com"
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-zinc-700">
                  Choose a username
                </span>
                <input
                  type="text"
                  name="username"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  placeholder="e.g. drivenation"
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-zinc-700">
                  Choose a password
                </span>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </label>
              {canceled && (
                <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  Checkout canceled. Your account isn&apos;t active yet — finish
                  payment to start.
                </div>
              )}
              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}
              <button
                type="submit"
                className="w-full rounded-md bg-zinc-900 text-white text-sm font-medium py-2 hover:bg-zinc-800"
              >
                Continue to payment
              </button>
              <p className="text-center text-[11px] text-zinc-500">
                {TRIAL_DAYS > 0
                  ? `You won't be charged until your ${TRIAL_DAYS}-day trial ends. Cancel anytime.`
                  : "Cancel anytime."}
              </p>
            </form>
          )}
        </div>
        <div className="text-center text-xs text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-zinc-700 underline">
            Sign in
          </Link>
        </div>
        <div className="text-center text-[11px] text-zinc-400">
          {APP_OWNER_LINE}
        </div>
      </div>
    </div>
  );
}
