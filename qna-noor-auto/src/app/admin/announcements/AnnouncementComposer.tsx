"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  retryFailedAnnouncementRecipients,
  saveAnnouncementDraft,
  sendAnnouncementBatch,
  sendAnnouncementTest,
  startAnnouncementSend,
} from "./actions";

type AnnouncementStatus = "draft" | "sending" | "sent";

type FailedRecipient = { email: string; error: string | null };

export function AnnouncementComposer({
  announcement,
  recipientCount,
  sentCount,
  failedCount,
  pendingCount,
  failedRecipients,
  supportEmail,
}: {
  announcement: {
    id: string;
    subject: string;
    body: string;
    status: AnnouncementStatus;
    testSentAt: string | null;
    testSentTo: string | null;
  };
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  failedRecipients: FailedRecipient[];
  supportEmail: string;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [isPending, startTransition] = useTransition();
  const [subject, setSubject] = useState(announcement.subject);
  const [body, setBody] = useState(announcement.body);
  const [savedSubject, setSavedSubject] = useState(announcement.subject);
  const [savedBody, setSavedBody] = useState(announcement.body);
  const [testTo, setTestTo] = useState(supportEmail);
  const [testSentAt, setTestSentAt] = useState(announcement.testSentAt);
  const [testSentTo, setTestSentTo] = useState(announcement.testSentTo);
  const [status, setStatus] = useState<AnnouncementStatus>(announcement.status);
  const [sent, setSent] = useState(sentCount);
  const [failed, setFailed] = useState(failedCount);
  const [left, setLeft] = useState(pendingCount);
  const [message, setMessage] = useState("");
  const dirty = subject !== savedSubject || body !== savedBody;
  const editable = status === "draft";

  async function runOneBatch() {
    if (inFlight.current || status !== "sending") return;
    inFlight.current = true;
    try {
      const result = await sendAnnouncementBatch(announcement.id);
      setSent(result.sentCount);
      setFailed(result.failedCount);
      setLeft(result.pendingCount);
      if (result.status === "sent") {
        setStatus("sent");
        router.refresh();
      } else if (!result.ok) {
        setMessage(result.error ?? "Sending could not continue.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sending could not continue.");
    } finally {
      inFlight.current = false;
    }
  }

  useEffect(() => {
    if (status !== "sending") return;
    let active = true;
    let timer: number;
    const run = async () => {
      if (!active) return;
      if (inFlight.current) {
        timer = window.setTimeout(run, 600);
        return;
      }
      inFlight.current = true;
      try {
        const result = await sendAnnouncementBatch(announcement.id);
        if (!active) return;
        setSent(result.sentCount);
        setFailed(result.failedCount);
        setLeft(result.pendingCount);
        if (result.status === "sending") {
          timer = window.setTimeout(run, result.processed === 0 ? 600 : 0);
        } else {
          setStatus(result.status === "sent" ? "sent" : "draft");
          router.refresh();
        }
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof Error ? error.message : "Sending could not continue.",
          );
        }
      } finally {
        inFlight.current = false;
      }
    };
    timer = window.setTimeout(run, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [announcement.id, router, status]);

  function save() {
    const form = new FormData();
    form.set("subject", subject);
    form.set("body", body);
    startTransition(async () => {
      const result = await saveAnnouncementDraft(announcement.id, form);
      if (!result.ok) {
        setMessage(result.error ?? "Draft could not be saved.");
        return;
      }
      setSavedSubject(subject);
      setSavedBody(body);
      if (!result.testSentAt) {
        setTestSentAt(null);
        setTestSentTo(null);
      }
      setMessage("Draft saved.");
      router.refresh();
    });
  }

  function sendTest() {
    const form = new FormData();
    form.set("subject", subject);
    form.set("body", body);
    form.set("to", testTo);
    startTransition(async () => {
      const result = await sendAnnouncementTest(announcement.id, form);
      setSavedSubject(subject);
      setSavedBody(body);
      setTestSentAt(result.testSentAt);
      setTestSentTo(result.ok ? testTo.trim() : null);
      setMessage(
        result.ok
          ? `Test email sent to ${testTo.trim()}.`
          : result.error ?? "Test email could not be sent.",
      );
      router.refresh();
    });
  }

  function startSending() {
    if (
      dirty ||
      !testSentAt ||
      !window.confirm(
        `Send this announcement to all ${recipientCount} account owners?`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await startAnnouncementSend(announcement.id);
      if (!result.ok) {
        setMessage(result.error ?? "Announcement could not be started.");
        return;
      }
      setMessage("Sending has started. Keep this page open or resume later.");
      setStatus("sending");
      router.refresh();
    });
  }

  function retryFailed() {
    if (!window.confirm(`Retry ${failed} failed announcement emails?`)) return;
    startTransition(async () => {
      const result = await retryFailedAnnouncementRecipients(announcement.id);
      if (!result.ok) {
        setMessage(result.error ?? "Failed recipients could not be retried.");
        return;
      }
      setLeft(failed);
      setStatus("sending");
      setMessage("Retrying failed recipients.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {message && (
        <p aria-live="polite" className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
          {message}
        </p>
      )}

      {editable ? (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
            className="space-y-4"
          >
            <label className="block space-y-1 text-sm font-medium text-zinc-700">
              Subject
              <input
                name="subject"
                value={subject}
                maxLength={150}
                onChange={(event) => setSubject(event.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
              />
              <span className="block text-xs font-normal text-zinc-500">
                {subject.length}/150
              </span>
            </label>
            <label className="block space-y-1 text-sm font-medium text-zinc-700">
              Plain-text body
              <textarea
                name="body"
                value={body}
                maxLength={10_000}
                rows={12}
                onChange={(event) => setBody(event.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900"
              />
              <span className="block text-xs font-normal text-zinc-500">
                {body.length}/10,000
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isPending || !dirty}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Save draft
              </button>
              <button
                type="button"
                onClick={sendTest}
                disabled={isPending}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50"
              >
                Send test email
              </button>
            </div>
            <label className="block space-y-1 text-sm font-medium text-zinc-700">
              Test recipient
              <input
                type="email"
                name="to"
                value={testTo}
                onChange={(event) => setTestTo(event.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
              />
            </label>
          </form>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <h3 className="font-semibold text-zinc-900">Preview</h3>
            <p className="mt-3 font-semibold text-zinc-900">{subject || "No subject"}</p>
            <div className="mt-2 space-y-3 whitespace-pre-wrap break-words text-sm text-zinc-700">
              {body || "No message body"}
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              Open Vultrix · You&apos;re getting this because you have a Vultrix
              account. Unsubscribe from announcements
            </p>
          </div>

          <div className="space-y-3 border-t border-zinc-200 pt-4">
            <p className="text-sm text-zinc-600">
              {testSentAt
                ? `Test send succeeded${testSentTo ? ` to ${testSentTo}` : ""}.`
                : "Send a successful test email before sending to everyone."}
              {dirty && " Save or test the edited content before sending."}
            </p>
            <button
              type="button"
              disabled={isPending || dirty || !testSentAt}
              onClick={startSending}
              className="rounded-md bg-[var(--vx-accent-600)] px-4 py-2 text-sm font-semibold text-[var(--vx-accent-fg)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send to everyone ({recipientCount} recipients)
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-zinc-500">Subject</p>
            <p className="mt-1 font-semibold text-zinc-900">{announcement.subject}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500">Message</p>
            <div className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-800">
              {announcement.body}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <h3 className="font-semibold text-zinc-900">
              {status === "sending" ? "Sending progress" : "Delivery summary"}
            </h3>
            <p className="mt-2 text-sm text-zinc-700">
              {sent} sent · {failed} failed · {left} left
            </p>
            {status === "sending" && (
              <button
                type="button"
                onClick={runOneBatch}
                disabled={isPending}
                className="mt-3 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 disabled:opacity-50"
              >
                Resume sending
              </button>
            )}
            {status === "sent" && failed > 0 && (
              <button
                type="button"
                onClick={retryFailed}
                disabled={isPending}
                className="mt-3 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 disabled:opacity-50"
              >
                Retry failed
              </button>
            )}
          </div>
          {failedRecipients.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-zinc-900">Failed recipients</h3>
              <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200">
                {failedRecipients.map((recipient) => (
                  <li key={recipient.email} className="p-3">
                    <p className="break-all text-sm font-medium text-zinc-800">
                      {recipient.email}
                    </p>
                    {recipient.error && (
                      <p className="mt-1 break-words text-xs text-red-700">
                        {recipient.error}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
