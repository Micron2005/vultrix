import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { APP_NAME, APP_OWNER_LINE } from "@/lib/branding";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  next?: string;
  error?: string;
  suspended?: string;
  pending?: string;
  reset?: string;
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next, error, suspended, pending, reset } = await searchParams;

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
          <LoginForm
            next={safeNext(next)}
            error={!!error}
            suspended={!!suspended}
            pending={!!pending}
            reset={!!reset}
          />
        </div>
        <div className="text-center text-xs text-zinc-500">
          New here?{" "}
          <a href="/signup" className="font-medium text-zinc-700 underline">
            Start your shop
          </a>
          <span className="mx-2 text-zinc-300">·</span>
          <a href="/" className="font-medium text-zinc-700 underline" data-testid="login-back-home">
            Back to home
          </a>
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

function safeNext(next: string | undefined | null): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("/login")) return "/";
  return next;
}
