import Link from "next/link";
import { APP_NAME, APP_OWNER_LINE } from "@/lib/branding";
import { requestReset } from "./actions";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
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
          <form action={requestReset} className="space-y-4" data-testid="forgot-form">
            <p className="text-sm text-zinc-600">
              Enter your username or email and we&apos;ll email you a 6-digit
              code to set a new password.
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
              Email me a code
            </button>
          </form>
        </div>

        <div className="text-center text-xs text-zinc-500">
          Already have a code?{" "}
          <Link
            href="/reset-password"
            className="font-medium text-zinc-700 underline"
            data-testid="forgot-have-code"
          >
            Enter it here
          </Link>
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
