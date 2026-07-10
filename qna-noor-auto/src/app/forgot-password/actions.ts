"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/lib/passwordReset";
import { RESET_ID_COOKIE } from "@/lib/resetCookie";

/**
 * Handle a "forgot password" request: email a 6-digit code and send the user to
 * the reset page. Always behaves identically whether or not the account exists,
 * so the form can't be used to probe which usernames/emails are registered.
 */
export async function requestReset(formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "").trim();
  await requestPasswordReset(identifier);

  const store = await cookies();
  store.set(RESET_ID_COOKIE, identifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 20 * 60, // 20 minutes
  });

  redirect("/reset-password?sent=1");
}
