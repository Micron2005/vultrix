"use server";

import { redirect } from "next/navigation";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/branding";
import { sendEmailResult, escapeHtml } from "@/lib/email";
import { requireSuperadmin } from "@/lib/session";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function sendTestEmail(formData: FormData) {
  await requireSuperadmin();

  const to = String(formData.get("to") ?? "").trim();
  if (!EMAIL_RE.test(to)) {
    redirect("/admin/email?error=Enter%20a%20valid%20email%20address");
  }

  const result = await sendEmailResult({
    kind: "test",
    orgId: null,
    to,
    subject: `${APP_NAME} email test`,
    replyTo: SUPPORT_EMAIL,
    html: `<div style="max-width:560px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b"><h1 style="font-size:22px">${escapeHtml(APP_NAME)}</h1><p>This is a test email from your Email health page.</p></div>`,
  });

  if (result.ok) {
    redirect(`/admin/email?notice=${encodeURIComponent(`Sent to ${to}`)}`);
  }
  redirect(
    `/admin/email?error=${encodeURIComponent(result.error ?? "Email send failed")}`,
  );
}
