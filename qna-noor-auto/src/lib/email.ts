// Tiny transactional-email helper built on Resend's REST API (no SDK, so no
// extra dependency). Mirrors the proven approach already used by the marketing
// leads endpoint. Sends are best-effort: if RESEND_API_KEY isn't set, calls
// no-op quietly so the app keeps working before email is configured.
//
// Env vars (set in Vercel → Settings → Environment Variables):
//   RESEND_API_KEY   your Resend API key (re_...)
//   MAIL_FROM        (optional) verified sender; falls back to LEADS_FROM_EMAIL
//                    and finally Resend's onboarding sender.

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Send one transactional email via Resend. Returns true on success, false if
 * email isn't configured or the send failed. Never throws.
 */
export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: SendArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping send to", to);
    return false;
  }

  const from =
    process.env.MAIL_FROM ||
    process.env.LEADS_FROM_EMAIL ||
    "Vultrix <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error(
        "[email] Resend send failed:",
        res.status,
        await res.text().catch(() => ""),
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] send error:", e);
    return false;
  }
}
