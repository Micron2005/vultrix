// Transactional-email helper built on Resend's REST API (no SDK dependency).
// Every attempted send is recorded in EmailLog without storing its HTML body.
//
// Env vars (set in Vercel → Settings → Environment Variables):
//   RESEND_API_KEY   your Resend API key (re_...)
//   MAIL_FROM        (optional) verified sender; falls back to LEADS_FROM_EMAIL
//                    and finally the platform's default noreply sender.

import { DEFAULT_MAIL_FROM } from "@/lib/branding";
import { db } from "@/lib/db";

export function emailBrandHeader(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://vultrix.net";
  return `<div style="padding:8px 0 16px"><img src="${base}/brand/vultrix-mark-email.png" width="40" height="40" alt="Vultrix" style="display:block;border-radius:8px"></div>`;
}

export function shopEmailHeader(args: {
  shopName: string;
  logo: string | null;
  accent: string | null;
}): string {
  const accent = args.accent ?? "#18181b";
  const logo = args.logo
    ? `<img src="${escapeHtml(args.logo)}" width="40" height="40" alt="" style="display:block;border-radius:8px;object-fit:contain">`
    : "";
  return `<div style="border-top:4px solid ${escapeHtml(accent)};padding:12px 0 16px;display:flex;align-items:center;gap:10px">${logo}<strong style="font-size:18px">${escapeHtml(args.shopName)}</strong></div>`;
}

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
  kind: string;
  orgId?: string | null;
  logSubject?: string;
};

export type EmailSendStatus = "SENT" | "FAILED" | "NOT_CONFIGURED";

export type EmailSendResult = {
  ok: boolean;
  status: EmailSendStatus;
  error: string | null;
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function emailFromAddress(): string {
  return (
    process.env.MAIL_FROM ||
    process.env.LEADS_FROM_EMAIL ||
    DEFAULT_MAIL_FROM
  );
}

export function resendErrorDetail(status: number, body: string): string {
  const trimmed = body.trim();
  let detail: string;

  try {
    const parsed: unknown = JSON.parse(body);
    if (
      parsed &&
      typeof parsed === "object" &&
      "name" in parsed &&
      typeof parsed.name === "string" &&
      "message" in parsed &&
      typeof parsed.message === "string"
    ) {
      detail = `Resend ${status} (${parsed.name}): ${parsed.message}`;
    } else {
      detail = trimmed ? `Resend ${status}: ${trimmed}` : `Resend ${status}`;
    }
  } catch {
    detail = trimmed ? `Resend ${status}: ${trimmed}` : `Resend ${status}`;
  }

  return detail.slice(0, 500);
}

/**
 * Send one transactional email via Resend and record the result.
 */
export async function sendEmailResult({
  to,
  subject,
  html,
  replyTo,
  headers,
  kind,
  orgId = null,
  logSubject,
}: SendArgs): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  let result: EmailSendResult;
  let providerMessageId: string | null = null;

  if (!apiKey) {
    result = {
      ok: false,
      status: "NOT_CONFIGURED",
      error: "RESEND_API_KEY is not set",
    };
  } else {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: emailFromAddress(),
          to: [to],
          subject,
          html,
          ...(replyTo ? { reply_to: replyTo } : {}),
          ...(headers ? { headers } : {}),
        }),
      });
      const body = await res.text().catch(() => "");
      if (!res.ok) {
        result = {
          ok: false,
          status: "FAILED",
          error: resendErrorDetail(res.status, body),
        };
      } else {
        try {
          const payload: unknown = JSON.parse(body);
          if (
            payload &&
            typeof payload === "object" &&
            "id" in payload &&
            typeof payload.id === "string"
          ) {
            providerMessageId = payload.id;
          }
        } catch {
          providerMessageId = null;
        }
        result = { ok: true, status: "SENT", error: null };
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      result = {
        ok: false,
        status: "FAILED",
        error: `Network error: ${message}`.slice(0, 500),
      };
    }
  }

  try {
    await db.emailLog.create({
      data: {
        orgId,
        kind,
        to,
        subject: logSubject ?? subject,
        status: result.status,
        error: result.error,
        providerMessageId,
      },
    });
  } catch (error) {
    console.error("[email] failed to write send log:", error);
  }

  return result;
}

export async function sendEmail(args: SendArgs): Promise<boolean> {
  return (await sendEmailResult(args)).ok;
}
