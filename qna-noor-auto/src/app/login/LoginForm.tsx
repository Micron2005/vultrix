"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "vultrix.rememberedUsername";

/**
 * Login form. "Remember me" persists the username to localStorage so it's
 * pre-filled on the next visit (and keeps the session cookie longer via the
 * posted `remember` flag). Unchecking it clears the saved username.
 */
export function LoginForm({
  next,
  error,
  suspended,
  pending,
}: {
  next: string;
  error?: boolean;
  suspended?: boolean;
  pending?: boolean;
}) {
  const [username, setUsername] = useState("");
  const [remember, setRemember] = useState(true);

  // Pre-fill the remembered username on first load. Reading localStorage must
  // happen after mount (it isn't available during SSR), so a one-time state
  // update here is the correct, SSR-safe pattern.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* localStorage unavailable — ignore */
    }
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsername(saved);
    }
  }, []);

  // Save (or clear) the remembered username right before the native POST.
  function handleSubmit() {
    try {
      if (remember && username.trim()) {
        window.localStorage.setItem(STORAGE_KEY, username.trim());
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <form
      action="/api/login"
      method="post"
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <input type="hidden" name="next" value={next} />
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
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          data-testid="login-username"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Password</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          data-testid="login-password"
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="remember"
          value="1"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="rounded border-zinc-300"
          data-testid="login-remember"
        />
        <span className="text-sm text-zinc-600">Remember me</span>
      </label>
      {error && (
        <div
          className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700"
          data-testid="login-error"
        >
          Wrong username or password. Try again.
        </div>
      )}
      {suspended && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          This account is on hold. Please contact your administrator.
        </div>
      )}
      {pending && (
        <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
          Payment is processing. Sign in shortly to access your account.
        </div>
      )}
      <button
        type="submit"
        className="w-full rounded-md bg-zinc-900 text-white text-sm font-medium py-2 hover:bg-zinc-800"
        data-testid="login-submit"
      >
        Sign in
      </button>
    </form>
  );
}
