import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getAllSettings } from "@/lib/shop";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next, error } = await searchParams;
  const shop = await getAllSettings();

  if (await isAuthenticated()) {
    redirect(safeNext(next));
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-xl font-semibold text-zinc-900">
            {shop.shopName}
          </div>
          <div className="text-xs text-zinc-500">Shop sign-in</div>
        </div>
        <div className="rounded-lg bg-white shadow-sm border border-zinc-200 p-6">
          <form action="/api/login" method="post" className="space-y-4">
            <input type="hidden" name="next" value={safeNext(next)} />
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                Password
              </span>
              <input
                type="password"
                name="password"
                required
                autoFocus
                autoComplete="current-password"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </label>
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                Wrong password. Try again.
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
        <div className="text-center text-xs text-zinc-500">
          Your team shares one password. Customer-facing links (estimates,
          portal, appointment reminders) work without signing in.
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
