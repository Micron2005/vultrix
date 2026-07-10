"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { completePasswordReset } from "@/lib/passwordReset";
import { RESET_ID_COOKIE } from "@/lib/resetCookie";

function backToForm(error: string): never {
  redirect(`/reset-password?error=${encodeURIComponent(error)}`);
}

/** Validate the identifier + code + password and set the new password. */
export async function submitNewPassword(formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const code = String(formData.get("code") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const store = await cookies();
  // Keep the identifier around so the form stays prefilled on any re-render.
  store.set(RESET_ID_COOKIE, identifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 20 * 60,
  });

  if (password !== confirm) backToForm("Passwords don't match.");

  const res = await completePasswordReset(identifier, code, password);
  if (!res.ok) backToForm(res.error);

  // Success -- clear the helper cookie and send them to sign in.
  store.delete(RESET_ID_COOKIE);
  redirect("/login?reset=1");
}
