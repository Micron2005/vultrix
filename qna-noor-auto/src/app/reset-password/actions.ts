"use server";

import { redirect } from "next/navigation";
import { completePasswordReset } from "@/lib/passwordReset";

function backToForm(token: string, error: string): never {
  redirect(
    `/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(error)}`,
  );
}

/** Validate the token + password and set the new password. */
export async function submitNewPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) backToForm(token, "Passwords don't match.");

  const res = await completePasswordReset(token, password);
  if (!res.ok) backToForm(token, res.error);

  redirect("/login?reset=1");
}
