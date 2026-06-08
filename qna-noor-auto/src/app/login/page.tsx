import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { APP_NAME, APP_OWNER_LINE } from "@/lib/branding";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  next?: string;
  error?: string;
  suspended?: string;
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next, error, suspended } = await searchParams;

  if (await getCurrentUser()) {
    redirect(safeNext(next));
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-2xl font-bold tracking-tight text-zinc-900">
            {APP_NAME}
          </div>
          <div className="text-xs text-zinc-500">Sign in to your account</div>
        </div>
        <div className="rounded-lg bg-white shadow-sm border border-zinc-200 p-6">
          <form action="/api/login" method="post" className="space-y-4">
            <input type="hidden" name="next" value={safeNext(next)} />
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Username</span>
              <input
                type="text"
                name="username"
                required
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                Password
              </span>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="remember"
                value="1"
                defaultChecked
                className="rounded border-zinc-300"
              />
              <span className="text-sm text-zinc-600">Remember me</span>
            </label>
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                Wrong username or password. Try again.
              </div>
            )}
            {suspended && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                This account is on hold. Please contact your administrator.
              </div>
            )}
            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 text-white text-sm font-medium py-2 hover:bg-zinc-800"
            >
              Sign in
            </button>
          </form>
        </div>
        <div className="text-center text-[11px] text-zinc-400">
          {APP_OWNER_LINE}
        </div>
      </div>
    </div>
  );
}

function safeNext(next: string | undefined | null): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("/login")) return "/";
  return next;
}
