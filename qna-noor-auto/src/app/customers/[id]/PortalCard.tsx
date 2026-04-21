"use client";

import { useState } from "react";
import { Button, Card, CardHeader } from "@/components/ui";
import {
  generatePortalToken,
  regeneratePortalToken,
  revokePortalToken,
} from "../portal";

export function PortalCard({
  customerId,
  token,
}: {
  customerId: string;
  token: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined" && token
      ? `${window.location.origin}/p/${token}`
      : token
        ? `/p/${token}`
        : null;

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader title="Customer portal link" />
      <div className="p-4 text-sm">
        {!token ? (
          <>
            <p className="text-zinc-600 mb-3">
              Give this customer a private link to view their vehicles, service
              history, and outstanding invoices. No login required — just send
              them the link.
            </p>
            <form action={generatePortalToken.bind(null, customerId)}>
              <Button type="submit" variant="secondary" size="sm">
                Generate portal link
              </Button>
            </form>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url ?? ""}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 font-mono text-xs text-zinc-700"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={copy}
              >
                {copied ? "Copied" : "Copy link"}
              </Button>
              <a
                href={url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Preview ↗
              </a>
            </div>
            <div className="mt-3 flex gap-2">
              <form
                action={regeneratePortalToken.bind(null, customerId)}
              >
                <Button type="submit" variant="ghost" size="sm">
                  Regenerate
                </Button>
              </form>
              <form action={revokePortalToken.bind(null, customerId)}>
                <Button type="submit" variant="danger" size="sm">
                  Revoke access
                </Button>
              </form>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Text or email this link to the customer. Regenerate to invalidate
              the old link. Revoke to kill access entirely.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
