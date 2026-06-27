"use client";

import { useState } from "react";
import { submitNewPassword } from "./actions";

const MIN = 6;

/**
 * New-password form for the reset flow. Shows a live "passwords match" hint and
 * a length check for friendly UX; the server action re-validates before saving.
 */
export function ResetPasswordForm({
  token,
  error,
}: {
  token: string;
  error?: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= MIN && confirm === password;

  return (
    <form action={submitNewPassword} className="space-y-4" data-testid="reset-form">
      <input type="hidden" name="token" value={token} />

      {error && (
        <div
          className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700"
          data-testid="reset-error"
        >
          {error}
        </div>
      )}

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">New password</span>
        <input
          type={show ? "text" : "password"}
          name="password"
          required
          minLength={MIN}
          autoFocus
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          data-testid="reset-password"
        />
        <span
          className={`mt-1 block text-xs ${tooShort ? "text-red-600" : "text-zinc-500"}`}
        >
          At least {MIN} characters.
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">
          Confirm new password
        </span>
        <input
          type={show ? "text" : "password"}
          name="confirm"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
            mismatch
              ? "border-red-300 focus:ring-red-400"
              : "border-zinc-300 focus:ring-zinc-400"
          }`}
          data-testid="reset-confirm"
        />
        {mismatch && (
          <span className="mt-1 block text-xs text-red-600">
            Passwords don&apos;t match.
          </span>
        )}
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
          className="rounded border-zinc-300"
          data-testid="reset-show-password"
        />
        <span className="text-sm text-zinc-600">Show password</span>
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-md bg-zinc-900 text-white text-sm font-medium py-2 transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="reset-submit"
      >
        Set new password
      </button>
    </form>
  );
}
