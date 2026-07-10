import Link from "next/link";
import { cookies } from "next/headers";
import { APP_NAME, APP_OWNER_LINE } from "@/lib/branding";
import { RESET_ID_COOKIE } from "@/lib/resetCookie";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string; sent?: string }>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, sent } = await searchParams;
  const store = await cookies();
  const prefillIdentifier = store.get(RESET_ID_COOKIE)?.value ?? "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-2xl font-bold tracking-tight text-zinc-900">
            {APP_NAME}
          </div>
          <div className="text-xs text-zinc-500">
            Enter your code and choose a new password
          </div>
        </div>

        <div className="rounded-lg bg-white shadow-sm border border-zinc-200 p-6">
          {sent && (
            <div
              className="mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700"
              data-testid="reset-code-sent"
            >
              If an account matches, we emailed a 6-digit code to the address on
              file. Enter it below (check spam too) — it expires in 15 minutes.
            </div>
          )}
          <ResetPasswordForm
            defaultIdentifier={prefillIdentifier}
            error={error}
          />
        </div>

        <div className="text-center text-xs text-zinc-500">
          Didn&apos;t get a code?{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-zinc-700 underline"
            data-testid="reset-request-new"
          >
            Request a new one
          </Link>
        </div>
        <div className="text-center text-xs text-zinc-500">
          <Link href="/login" className="font-medium text-zinc-700 underline">
            Back to sign in
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
