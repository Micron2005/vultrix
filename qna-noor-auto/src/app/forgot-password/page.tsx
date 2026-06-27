import Link from "next/link";
import { APP_NAME, APP_OWNER_LINE } from "@/lib/branding";
import { requestReset } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ sent?: string }>;

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { sent } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-2xl font-bold tracking-tight text-zinc-900">
            {APP_NAME}
          </div>
          <div className="text-xs text-zinc-500">Reset your password</div>
        </div>

        <div className="rounded-lg bg-white shadow-sm border border-zinc-200 p-6">
          {sent ? (
            <div className="space-y-4" data-testid="forgot-sent">
              <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                If an account matches that username or email, we&apos;ve sent a
                link to reset your password. Check your inbox (and spam folder)
                — the link expires in 1 hour.
              </div>
              <Link
                href="/login"
                className="block w-full rounded-md bg-zinc-900 text-center text-white text-sm font-medium py-2 transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                data-testid="forgot-back-to-login"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form action={requestReset} className="space-y-4" data-testid="forgot-form">
              <p className="text-sm text-zinc-600">
                Enter your username or email and we&apos;ll send you a link to
                set a new password.
              </p>
              <label className="block">
                <span className="text-sm font-medium text-zinc-700">
                  Username or email
                </span>
                <input
                  type="text"
                  name="identifier"
                  required
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  data-testid="forgot-identifier"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-md bg-zinc-900 text-white text-sm font-medium py-2 transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                data-testid="forgot-submit"
              >
                Send reset link
              </button>
            </form>
          )}
        </div>

        <div className="text-center text-xs text-zinc-500">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-zinc-700 underline">
            Sign in
          </Link>
        </div>
        <div className="flex items-center justify-center gap-3 text-[11px] text-zinc-400">
          <a href="/terms" className="underline hover:text-zinc-600">
            Terms
          </a>
          <span>·</span>
          <a href="/privacy" className="underline hover:text-zinc-600">
            Privacy
          </a>
        </div>
        <div className="text-center text-[11px] text-zinc-400">
          {APP_OWNER_LINE}
        </div>
      </div>
    </div>
  );
}
