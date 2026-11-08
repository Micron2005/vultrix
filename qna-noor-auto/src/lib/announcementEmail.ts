import { emailBrandHeader, escapeHtml } from "@/lib/email";
import { unsubscribeToken } from "@/lib/announcements";

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://vultrix.net"
  );
}

export function announcementUnsubscribeUrl(orgId: string): string {
  const token = unsubscribeToken(orgId);
  if (!token) {
    throw new Error("Configure INTAKE_SIGNING_SECRET or STOCK_SCAN_SIGNING_SECRET.");
  }
  return `${appUrl()}/unsubscribe?o=${encodeURIComponent(orgId)}&t=${encodeURIComponent(token)}`;
}

export function announcementListUnsubscribeHeaders(
  orgId: string,
): Record<string, string> {
  const token = unsubscribeToken(orgId);
  if (!token) {
    throw new Error("Configure INTAKE_SIGNING_SECRET or STOCK_SCAN_SIGNING_SECRET.");
  }
  const url = `${appUrl()}/api/unsubscribe?o=${encodeURIComponent(orgId)}&t=${encodeURIComponent(token)}`;
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export function announcementEmailHtml(
  body: string,
  unsubscribeUrl: string,
): string {
  const paragraphs = body
    .trim()
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  const openUrl = escapeHtml(appUrl());
  return `<div style="max-width:600px;margin:0 auto;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;line-height:1.6">${emailBrandHeader()}${paragraphs}<p style="margin:24px 0"><a href="${openUrl}" style="display:inline-block;border-radius:6px;background:#2563eb;padding:10px 16px;color:#fff;text-decoration:none;font-weight:600">Open Vultrix</a></p><p style="margin:24px 0 0;color:#71717a;font-size:12px">You're getting this because you have a Vultrix account. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#52525b">Unsubscribe from announcements</a></p></div>`;
}
