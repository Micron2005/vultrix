"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { CustomerContactLists, CustomerContactOption } from "@/lib/customerContacts";

/**
 * Row of share actions: Email, Text, and Open-in-new-tab (for print). The
 * caller supplies the path and message builders so the same controls can be
 * used for different customer-facing links.
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
  contactLists,
  customerName,
  compact = false,
  pathPrefix = "/e/",
  emailSubject,
  buildEmailBody,
  buildSmsBody,
}: {
  token: string;
  contactLists: CustomerContactLists;
  customerName: string;
  /**
   * `compact` skips the Open-in-new-tab / Print buttons and just renders
   * Email + Text. Used by the top-right lifecycle action bar where the
   * "Invoice PDF" / "Print Estimate" LinkButton already covers the
   * open-in-new-tab + print flow.
   */
  compact?: boolean;
  pathPrefix?: string;
  emailSubject: string;
  buildEmailBody: (shareUrl: string) => string;
  buildSmsBody: (shareUrl: string) => string;
}) {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const shareUrl = origin ? `${origin}${pathPrefix}${token}` : "";
  const body = buildEmailBody(shareUrl);
  const smsBody = buildSmsBody(shareUrl);

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
        available={contactLists.emails.length > 0 && !!shareUrl}
        title={`Send email to ${customerName}`}
        defaultBody={body}
        subject={emailSubject}
        channel="email"
        contacts={contactLists.emails}
      />

      <SendPopover
        label="Text customer"
        disabledLabel="Text (no phone on file)"
        emptyTitle="Customer has no phone on file — add one on the customer page."
        available={contactLists.phones.length > 0 && !!shareUrl}
        title={`Send text to ${customerName}`}
        defaultBody={smsBody}
        channel="sms"
        contacts={contactLists.phones}
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
  defaultBody,
  subject,
  channel,
  contacts,
}: {
  label: string;
  disabledLabel: string;
  emptyTitle: string;
  available: boolean;
  title: string;
  defaultBody: string;
  subject?: string;
  channel: Channel;
  contacts: CustomerContactOption[];
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState(defaultBody);
  const [copied, setCopied] = useState(false);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>(() => {
    const primaryIndex = contacts.findIndex((contact) => contact.isPrimary);
    return [primaryIndex >= 0 ? primaryIndex : 0];
  });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const multipleContacts = contacts.length > 1;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const selectedContacts = selectedIndexes
    .map((index) => contacts[index])
    .filter((contact): contact is CustomerContactOption => !!contact);
  const recipientLabel = selectedContacts
    .map((contact) => contact.label ? `${contact.label}: ${contact.value}` : contact.value)
    .join(", ");
  const selectedRecipients = selectedContacts.map((contact) => contact.value);
  const encodedRecipients = selectedRecipients
    .map((recipient) => encodeURIComponent(recipient))
    .join(",");
  const mailtoHref = `mailto:${encodedRecipients}?subject=${encodeURIComponent(subject ?? "")}&body=${encodeURIComponent(msg)}`;
  const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedRecipients}&su=${encodeURIComponent(subject ?? "")}&body=${encodeURIComponent(msg)}`;

  function phoneHref(contact: CustomerContactOption, scheme: "sms" | "whatsapp") {
    const phoneDigits = contact.value.replace(/[^+\d]/g, "");
    if (scheme === "sms") {
      return `sms:${phoneDigits}?body=${encodeURIComponent(msg)}`;
    }
    return `https://wa.me/${phoneDigits.replace(/^\+/, "")}?text=${encodeURIComponent(msg)}`;
  }

  function toggleIndex(index: number) {
    setSelectedIndexes((current) =>
      current.includes(index)
        ? current.filter((value) => value !== index)
        : [...current, index],
    );
  }

  function selectAll() {
    setSelectedIndexes(contacts.map((_, index) => index));
  }

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
            {multipleContacts ? (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Recipients</span>
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-zinc-900 underline"
                  >
                    Select all
                  </button>
                </div>
                {contacts.map((contact, index) => (
                  <label
                    key={`${contact.value}-${index}`}
                    className="flex items-center gap-2 text-xs text-zinc-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIndexes.includes(index)}
                      onChange={() => toggleIndex(index)}
                    />
                    <span>
                      {contact.label ? `${contact.label}: ` : ""}
                      <span className="font-mono">{contact.value}</span>
                      {contact.isPrimary ? " (primary)" : ""}
                    </span>
                  </label>
                ))}
                {selectedContacts.length === 0 && (
                  <p className="pt-1 text-[11px] text-zinc-500 leading-snug">
                    Select at least one recipient.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-xs text-zinc-500">
                To: <span className="font-mono">{recipientLabel}</span>
              </div>
            )}
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
                  {selectedContacts.length === 0 ? (
                    <span className="text-[11px] text-zinc-500">
                      Select at least one recipient.
                    </span>
                  ) : (
                    selectedContacts.map((contact, index) => (
                      <Fragment key={`${contact.value}-${index}`}>
                        <a
                          href={phoneHref(contact, "sms")}
                          className="inline-flex items-center h-8 px-3 rounded-md text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800"
                        >
                          {multipleContacts
                            ? `Open SMS: ${contact.label || contact.value}`
                            : "Open SMS app"}
                        </a>
                        <a
                          href={phoneHref(contact, "whatsapp")}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center h-8 px-3 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700"
                        >
                          {multipleContacts
                            ? `Open WhatsApp: ${contact.label || contact.value}`
                            : "Open WhatsApp"}
                        </a>
                      </Fragment>
                    ))
                  )}
                </>
              ) : (
                <>
                  <a
                    href={selectedContacts.length > 0 ? mailtoHref : undefined}
                    aria-disabled={selectedContacts.length === 0}
                    className="inline-flex items-center h-8 px-3 rounded-md text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                  >
                    Open mail app
                  </a>
                  <a
                    href={selectedContacts.length > 0 ? gmailHref : undefined}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={selectedContacts.length === 0}
                    className="inline-flex items-center h-8 px-3 rounded-md text-xs font-medium border border-zinc-300 bg-white hover:bg-zinc-50 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                  >
                    Open Gmail ↗
                  </a>
                </>
              )}
            </div>
            <p className="pt-1 text-[11px] text-zinc-500 leading-snug">
              {channel === "sms"
                ? multipleContacts
                  ? "Each selected number opens separately, one message each."
                  : "On a phone, Open SMS app drops this into your messages. On a computer, use WhatsApp or tap Copy and paste into whichever app you prefer."
                : selectedContacts.length === 0
                  ? "Select at least one recipient."
                  : "Open mail app uses your default email client (Outlook / Apple Mail). If that doesn't open, use Open Gmail or Copy the text."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
