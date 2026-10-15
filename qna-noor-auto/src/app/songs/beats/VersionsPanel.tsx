"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";

export type BeatVersionSummary = {
  id: string;
  name: string;
  auto: boolean;
  authorOrgId: string;
  authorName: string;
  createdAt: string;
  bpm: number;
  swing: number;
  kit: string;
};

export function VersionsPanel({
  beatId, versions: initial, saveBeforeSnapshot, onRestore, onRename, onDelete, onSave,
}: {
  beatId: string;
  versions: BeatVersionSummary[];
  saveBeforeSnapshot: () => Promise<boolean>;
  onRestore: (id: string) => Promise<unknown>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSave: (id: string, name?: string) => Promise<BeatVersionSummary>;
}) {
  const [versions, setVersions] = useState(initial);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      if (!await saveBeforeSnapshot()) throw new Error("Save the beat before creating a version.");
      const version = await onSave(beatId, name.trim() || undefined);
      setVersions((current) => [version, ...current].slice(0, 60));
      setName("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save version.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <details>
        <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-zinc-900">Versions</summary>
        <p className="mb-3 text-xs text-zinc-500">Saves the beat — tracks, patterns, arrangement. Vocals aren&apos;t included.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="Optional version name" aria-label="Version name" />
          <Button type="button" className="min-h-10" disabled={busy} onClick={() => void save()}>Save version</Button>
        </div>
        {message && <p className="mt-2 text-xs text-zinc-600">{message}</p>}
        <ul className="mt-3 divide-y divide-zinc-200">
          {versions.map((version) => (
            <li key={version.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                {editing === version.id ? (
                  <Input autoFocus defaultValue={version.name} maxLength={60} aria-label="Rename version" onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      const value = event.currentTarget.value.trim();
                      if (value) void onRename(version.id, value).then(() => {
                        setVersions((items) => items.map((item) => item.id === version.id ? { ...item, name: value } : item));
                        setEditing(null);
                      });
                    }
                    if (event.key === "Escape") setEditing(null);
                  }} />
                ) : (
                  <button type="button" className="min-h-10 text-left text-sm font-medium text-zinc-900" onClick={() => setEditing(version.id)}>{version.name}</button>
                )}
                <p className="text-xs text-zinc-500">{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(version.createdAt))} · {version.authorName} {version.auto && <span className="rounded bg-zinc-100 px-1.5 py-0.5">Auto</span>}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="min-h-10" variant="secondary" onClick={() => {
                  if (!window.confirm(`Replace the current beat with “${version.name}”? A copy of the current beat is saved first.`)) return;
                  setBusy(true);
                  void onRestore(version.id).then(() => {
                    setMessage("Version restored.");
                    router.refresh();
                  }).catch(() => setMessage("Could not restore version.")).finally(() => setBusy(false));
                }} disabled={busy}>Restore</Button>
                <Button type="button" className="min-h-10 w-10" variant="ghost" aria-label={`Delete ${version.name}`} onClick={() => {
                  if (!window.confirm(`Delete “${version.name}”?`)) return;
                  void onDelete(version.id).then(() => setVersions((items) => items.filter((item) => item.id !== version.id)));
                }}>×</Button>
              </div>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
