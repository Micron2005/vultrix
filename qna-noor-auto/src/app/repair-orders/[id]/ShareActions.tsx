"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Row of share actions under the ShareLinkPanel: Email, Text, and Open-in-
 * new-tab (for print). All three build off the same /e/<token> URL, which
 * ShareLinkPanel also uses, so the customer sees the same page however we
 * deliver it.
 *
 * Historically this component relied on bare `mailto:` / `sms:` links. On a
 * desktop browser with no handler registered for those schemes, clicking
 * the link silently did nothing. Instead, each button now opens a small
 * popover containing:
 *
 *   - an editable textarea prefilled with the message,
 *   - a Copy button,
 *   - an "Open SMS app" / "Open mail app" button (sms: / mailto:),
 *   - an "Open WhatsApp" (for text) or "Open Gmail" (for email) fallback
 *     that works on any desktop browser.
 *
 * The operator still hits Send themselves — no Twilio / SMTP required.
 */
export function ShareActions({
  token,
  customerEmail,
  customerPhone,
  customerName,
  roNumber,
  shopName,
  docLabel = "Invoice",
  compact = false,
}: {
  token: string;
  customerEmail: string | null | undefined;
  customerPhone: string | null | undefined;
  customerName: string;
  roNumber: number;
  shopName: string;
  docLabel?: "Estimate" | "Invoice";
  /**
   * `compact` skips the Open-in-new-tab / Print buttons and just renders
   * Email + Text. Used by the top-right lifecycle action bar where the
   * "Invoice PDF" / "Print Estimate" LinkButton already covers the
   * open-in-new-tab + print flow.
   */
  compact?: boolean;
}) {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const shareUrl = origin ? `${origin}/e/${token}` : "";

  const firstName = customerName.split(" ")[0] || "there";
  const verb = docLabel === "Estimate" ? "estimate" : "invoice";
  const subject = `${shopName} — ${docLabel} #${roNumber}`;
  const body =
    `Hi ${firstName},\n\n` +
    `Here's your ${verb} for RO #${roNumber}:\n${shareUrl}\n\n` +
    (docLabel === "Estimate"
      ? `You can review the details, approve the estimate, and see your balance.\n\n`
      : `You can review the itemized charges, print a copy, or reply to this message with any questions.\n\n`) +
    `Thanks,\n${shopName}`;

  const smsBody = `${shopName} — ${verb} for RO #${roNumber}: ${shareUrl}`;

  function openPrint() {
    if (!shareUrl) return;
    const w = window.open(shareUrl, "_blank", "noopener,noreferrer");
    if (w) {
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
      {!compact && (
        <>
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
        </>
      )}

      <SendPopover
        label="Email customer"
        disabledLabel="Email (no email on file)"
        emptyTitle="Customer has no email on file — add one on the customer page."
        available={!!customerEmail && !!shareUrl}
        title={`Send email to ${customerName}`}
        recipientLabel={customerEmail ?? ""}
        defaultBody={body}
        subject={subject}
        channel="email"
        recipient={customerEmail ?? ""}
      />

      <SendPopover
        label="Text customer"
        disabledLabel="Text (no phone on file)"
        emptyTitle="Customer has no phone on file — add one on the customer page."
        available={!!customerPhone && !!shareUrl}
        title={`Send text to ${customerName}`}
        recipientLabel={customerPhone ?? ""}
        defaultBody={smsBody}
        channel="sms"
        recipient={customerPhone ?? ""}
      />
    </div>
  );
}

type Channel = "email" | "sms";

/**
 * A small inline popover that lets the operator edit the pre-filled
 * message, copy it to the clipboard, and launch it in the SMS app /
 * WhatsApp (for texts) or in the default mail app / Gmail web compose
 * (for emails). Using multiple launch options means the button always
 * does *something* visible even if the user's OS has no handler for
 * `sms:` / `mailto:`.
 */
function SendPopover({
  label,
  disabledLabel,
  emptyTitle,
  available,
  title,
  recipientLabel,
  defaultBody,
  subject,
  channel,
  recipient,
}: {
  label: string;
  disabledLabel: string;
  emptyTitle: string;
  available: boolean;
  title: string;
  recipientLabel: string;
  defaultBody: string;
  subject?: string;
  channel: Channel;
  recipient: string;
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState(defaultBody);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Reset the body whenever the underlying default changes (e.g. share
  // token becomes available after the initial render).
  useEffect(() => {
    setMsg(defaultBody);
  }, [defaultBody]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!available) {
    return (
      <span
        title={emptyTitle}
        className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium bg-zinc-200 text-zinc-500 cursor-not-allowed"
      >
        {disabledLabel}
      </span>
    );
  }

  const phoneDigits = recipient.replace(/[^+\d]/g, "");
  const smsHref = `sms:${phoneDigits}?body=${encodeURIComponent(msg)}`;
  const waHref = `https://wa.me/${phoneDigits.replace(/^\+/, "")}?text=${encodeURIComponent(msg)}`;

  const mailtoHref = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject ?? "")}&body=${encodeURIComponent(msg)}`;
  const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${encodeURIComponent(subject ?? "")}&body=${encodeURIComponent(msg)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Some browsers block clipboard writes from insecure contexts.
      // Fall back to the textarea select+copy trick.
      const ta = rootRef.current?.querySelector("textarea");
      if (ta) {
        ta.focus();
        ta.select();
        try {
          document.execCommand("copy");
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Give up silently; the user can still Ctrl+C.
        }
      }
    }
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800"
      >
        {label}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-[min(420px,90vw)] rounded-lg border border-zinc-200 bg-white shadow-lg">
          <div className="p-3 border-b border-zinc-200">
            <div className="text-sm font-medium text-zinc-900">{title}</div>
            <div className="text-xs text-zinc-500">
              To: <span className="font-mono">{recipientLabel}</span>
            </div>
          </div>
          <div className="p-3 space-y-2">
            <label className="text-xs text-zinc-500">Message</label>
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={channel === "sms" ? 3 : 6}
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center h-8 px-3 rounded-md text-xs font-medium border border-zinc-300 bg-white hover:bg-zinc-50"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              {channel === "sms" ? (
                <>
                  <a
                    href={smsHref}
                    className="inline-flex items-center h-8 px-3 rounded-md text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800"
                  >
                    Open SMS app
                  </a>
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center h-8 px-3 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700"
                  >
                    Open WhatsApp
                  </a>
                </>
              ) : (
                <>
                  <a
                    href={mailtoHref}
                    className="inline-flex items-center h-8 px-3 rounded-md text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800"
                  >
                    Open mail app
                  </a>
                  <a
                    href={gmailHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center h-8 px-3 rounded-md text-xs font-medium border border-zinc-300 bg-white hover:bg-zinc-50"
                  >
                    Open Gmail ↗
                  </a>
                </>
              )}
            </div>
            <p className="pt-1 text-[11px] text-zinc-500 leading-snug">
              {channel === "sms"
                ? "On a phone, Open SMS app drops this into your messages. On a computer, use WhatsApp or tap Copy and paste into whichever app you prefer."
                : "Open mail app uses your default email client (Outlook / Apple Mail). If that doesn't open, use Open Gmail or Copy the text."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
