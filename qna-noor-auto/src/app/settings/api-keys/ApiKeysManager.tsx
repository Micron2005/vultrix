"use client";

import { useActionState, useState } from "react";
import { Button, Card, CardHeader, Field, Input } from "@/components/ui";
import {
  createApiKeyAction,
  revokeApiKeyAction,
  type CreateApiKeyState,
} from "./actions";

export type ApiKeyListItem = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export function ApiKeysManager({
  apiKeys,
  apiBaseUrl,
}: {
  apiKeys: ApiKeyListItem[];
  apiBaseUrl: string;
}) {
  const [state, formAction, pending] = useActionState<
    CreateApiKeyState | null,
    FormData
  >(createApiKeyAction, null);

  return (
    <>
      <Card className="max-w-2xl">
        <CardHeader title="Create an API key" />
        <form action={formAction} className="p-6 space-y-4">
          <Field label="Key name">
            <Input
              name="name"
              required
              maxLength={100}
              placeholder="Alfred"
            />
          </Field>
          <p className="text-xs text-zinc-500">
            Use a descriptive name so you can identify where this key is used.
          </p>
          {state?.error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}
          <Button disabled={pending} type="submit">
            {pending ? "Generating…" : "Generate API key"}
          </Button>
        </form>
        {state?.token && <NewToken token={state.token} />}
      </Card>

      <Card className="mt-6 max-w-4xl">
        <CardHeader title={`API keys (${apiKeys.length})`} />
        {apiKeys.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500">No API keys yet.</p>
        ) : (
          <div className="divide-y divide-zinc-200">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <div>
                  <div className="font-medium text-zinc-900">{key.name}</div>
                  <div className="mt-1 font-mono text-xs text-zinc-600">
                    {key.prefix}…
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Created {formatDate(key.createdAt)} · Last used{" "}
                    {key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}
                    {key.revokedAt && " · Revoked"}
                  </div>
                </div>
                {!key.revokedAt && (
                  <form action={revokeApiKeyAction.bind(null, key.id)}>
                    <Button type="submit" variant="danger" size="sm">
                      Revoke
                    </Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-6 max-w-4xl">
        <CardHeader title="Connect your assistant" />
        <div className="p-6 space-y-3 text-sm text-zinc-700">
          <p>
            Send your API key as a Bearer token. Keys are scoped to your
            organization and are never shown again after creation.
          </p>
          <pre className="overflow-x-auto rounded-md bg-zinc-900 p-4 text-xs text-zinc-100">
            {`curl -H "Authorization: Bearer <your-api-key>" ${apiBaseUrl}/api/v1/me`}
          </pre>
        </div>
      </Card>
    </>
  );
}

function NewToken({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copyToken() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
  }

  return (
    <div className="border-t border-amber-200 bg-amber-50 p-6">
      <p className="font-medium text-amber-950">Copy this API key now</p>
      <p className="mt-1 text-sm text-amber-900">
        It will not be shown again. Store it securely in Alfred.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md border border-amber-300 bg-white px-3 py-2 text-xs text-zinc-900">
          {token}
        </code>
        <Button type="button" variant="secondary" onClick={copyToken}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
