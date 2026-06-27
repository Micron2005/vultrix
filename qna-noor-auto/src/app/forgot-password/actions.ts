"use server";

import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/lib/passwordReset";

/**
 * Handle a "forgot password" request. Always redirects to the same generic
 * confirmation so the form can't be used to probe which usernames/emails exist.
 */
export async function requestReset(formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "");
  await requestPasswordReset(identifier);
  redirect("/forgot-password?sent=1");
}
