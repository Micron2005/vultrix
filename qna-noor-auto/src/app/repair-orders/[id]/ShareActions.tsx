"use client";

import { useEffect, useState } from "react";

/**
 * Row of share actions under the ShareLinkPanel: Email, Text, and Open-in-
 * new-tab (for print). All three build off the same /e/<token> URL, which
 * ShareLinkPanel also uses, so the customer sees the same page however we
 * deliver it.
 *
 * Email and Text use mailto: / sms: URI schemes so they pop open the
 * operator's default mail / messaging app with the recipient + subject +
 * body pre-filled — no SMTP or Twilio account needed. The operator still
 * hits Send themselves.
 */
export function ShareActions({
  token,
  customerEmail,
  customerPhone,
  customerName,
  roNumber,
  shopName,
  docLabel = "Invoice",
}: {
  token: string;
  customerEmail: string | null | undefined;
  customerPhone: string | null | undefined;
  customerName: string;
  roNumber: number;
  shopName: string;
  docLabel?: "Estimate" | "Invoice";
}) {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const shareUrl = origin ? `${origin}/e/${token}` : "";

  const subject = `${shopName} — ${docLabel} #${roNumber}`;
  const verb = docLabel === "Estimate" ? "estimate" : "invoice";
  const body =
    `Hi ${customerName.split(" ")[0] || "there"},\n\n` +
    `Here's your ${verb} for RO #${roNumber}:\n${shareUrl}\n\n` +
    (docLabel === "Estimate"
      ? `You can review the details, approve the estimate, and see your balance.\n\n`
      : `You can review the itemized charges, print a copy, or reply to this message with any questions.\n\n`) +
    `Thanks,\n${shopName}`;

  const mailtoHref = shareUrl
    ? `mailto:${encodeURIComponent(customerEmail ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : "";

  // SMS URI scheme: most phones support sms:<number>?body=... (iOS uses &
  // after the number, Android uses ?). Using ? works on both for the first
  // param. Leading + keeps international formatting intact.
  const smsBody = `${shopName} — ${verb} for RO #${roNumber}: ${shareUrl}`;
  const smsHref = shareUrl
    ? `sms:${(customerPhone ?? "").replace(/[^+\d]/g, "")}?body=${encodeURIComponent(smsBody)}`
    : "";

  function openPrint() {
    if (!shareUrl) return;
    const w = window.open(shareUrl, "_blank", "noopener,noreferrer");
    if (w) {
      // Give the new tab a beat to render, then trigger its print dialog.
      // If the popup is blocked, w is null and the operator can just Ctrl+P
      // in the tab they land on manually.
      setTimeout(() => {
        try {
          w.focus();
          w.print();
        } catch {
          // Some browsers block cross-tab print triggers; fall back to the
          // manual Ctrl+P the operator already has.
        }
      }, 800);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={shareUrl || "#"}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium border border-zinc-300 bg-white hover:bg-zinc-50"
      >
        Open in new tab ↗
      </a>
      <button
        type="button"
        onClick={openPrint}
        disabled={!shareUrl}
        className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-50"
      >
        Print (opens new tab)
      </button>
      {customerEmail ? (
        <a
          href={mailtoHref}
          className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800"
        >
          Email customer
        </a>
      ) : (
        <span
          title="Customer has no email on file — add one on the customer page."
          className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium bg-zinc-200 text-zinc-500 cursor-not-allowed"
        >
          Email (no email on file)
        </span>
      )}
      {customerPhone ? (
        <a
          href={smsHref}
          className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800"
        >
          Text customer
        </a>
      ) : (
        <span
          title="Customer has no phone on file — add one on the customer page."
          className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium bg-zinc-200 text-zinc-500 cursor-not-allowed"
        >
          Text (no phone on file)
        </span>
      )}
    </div>
  );
}
