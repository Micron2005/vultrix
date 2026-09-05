import { notFound, redirect } from "next/navigation";
import { VultrixMark } from "@/components/VultrixMark";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; locked?: string }>;
}) {
  const user = await getCurrentUser();
  if (user?.role === "SUPERADMIN") redirect("/admin");
  if (user) notFound();

  const sp = (await searchParams) ?? {};
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <VultrixMark variant="light" className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-xl font-semibold text-zinc-900">
            Vultrix platform admin
          </h1>
          <form action="/api/admin/login" method="post" className="mt-6 space-y-4">
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
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Password</span>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">
                Authenticator code
              </span>
              <input
                type="text"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            {sp.locked && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Too many attempts. Try again in 15 minutes.
              </p>
            )}
            {sp.error && !sp.locked && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Sign-in failed.
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
