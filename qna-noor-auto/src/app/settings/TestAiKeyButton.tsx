"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function TestAiKeyButton({
  aiKeyConfigured,
}: {
  aiKeyConfigured: boolean;
}) {
  const [status, setStatus] = useState<{
    kind: "success" | "error" | "testing";
    message: string;
  } | null>(null);

  async function testKey(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    const provider = form?.elements.namedItem("provider");
    const apiKey = form?.elements.namedItem("apiKey");
    const providerValue =
      provider instanceof HTMLSelectElement ? provider.value : "";
    const apiKeyValue = apiKey instanceof HTMLInputElement ? apiKey.value : "";
    setStatus({ kind: "testing", message: "Testing…" });
    try {
      const response = await fetch("/api/assistant/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerValue,
          ...(apiKeyValue.trim() ? { apiKey: apiKeyValue } : {}),
        }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "The key could not be tested.");
      }
      setStatus({
        kind: body.ok ? "success" : "error",
        message: body.message ?? "The key could not be tested.",
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The key could not be tested.",
      });
    }
  }

  const statusClass =
    status?.kind === "success"
      ? "text-green-700"
      : status?.kind === "error"
        ? "text-red-700"
        : "text-zinc-500";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="secondary"
        onClick={testKey}
        disabled={!aiKeyConfigured || status?.kind === "testing"}
      >
        Test my key
      </Button>
      {status && (
        <span className={`text-xs ${statusClass}`} aria-live="polite">
          {status.message}
        </span>
      )}
    </div>
  );
}
