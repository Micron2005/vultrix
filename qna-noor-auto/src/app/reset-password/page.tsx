import Link from "next/link";
import { APP_NAME, APP_OWNER_LINE } from "@/lib/branding";
import { isResetTokenValid } from "@/lib/passwordReset";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ token?: string; error?: string }>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { token, error } = await searchParams;
  const valid = token ? await isResetTokenValid(token) : false;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-2xl font-bold tracking-tight text-zinc-900">
            {APP_NAME}
          </div>
          <div className="text-xs text-zinc-500">Choose a new password</div>
        </div>

        <div className="rounded-lg bg-white shadow-sm border border-zinc-200 p-6">
          {valid && token ? (
            <ResetPasswordForm token={token} error={error} />
          ) : (
            <div className="space-y-4" data-testid="reset-invalid">
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                This reset link is invalid, has expired, or was already used.
                Reset links are good for 1 hour.
              </div>
              <Link
                href="/forgot-password"
                className="block w-full rounded-md bg-zinc-900 text-center text-white text-sm font-medium py-2 transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                data-testid="reset-request-new"
              >
                Request a new link
              </Link>
            </div>
          )}
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
