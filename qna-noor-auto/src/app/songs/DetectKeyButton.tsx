"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { chromaFromAudio, detectKey } from "@/lib/pitch";
import { setSongKey } from "./actions";

export function DetectKeyButton({
  src,
  songId,
  canSet,
}: {
  src: string;
  songId?: string;
  canSet: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    label: string;
    confidence: number;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function detect() {
    setBusy(true);
    setResult(null);
    setMessage("");
    setError("");
    let context: AudioContext | null = null;
    try {
      const response = await fetch(src, { cache: "no-store" });
      if (!response.ok) throw new Error("Audio could not be loaded.");
      const data = await response.arrayBuffer();
      context = new AudioContext();
      const audio = await context.decodeAudioData(data);
      const detected = detectKey(
        chromaFromAudio(audio.getChannelData(0), audio.sampleRate),
      );
      if (!detected) throw new Error("Not enough clear notes to detect a key.");
      setResult({ label: detected.label, confidence: detected.confidence });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to detect a key from this take.",
      );
    } finally {
      if (context && context.state !== "closed") await context.close();
      setBusy(false);
    }
  }

  async function saveKey() {
    if (!songId || !result) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await setSongKey(songId, result.label);
      setMessage("Song key saved.");
    } catch {
      setError("Unable to save the song key.");
    } finally {
      setSaving(false);
    }
  }

  const confident = result !== null && result.confidence >= 0.5;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => void detect()}
      >
        {busy ? "Analyzing…" : "Key?"}
      </Button>
      {result && (
        <span className="text-xs text-zinc-600">
          {confident
            ? `Likely ${result.label} · ${Math.round(result.confidence * 100)}%`
            : "Not sure — try a longer take"}
        </span>
      )}
      {confident && songId && canSet && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={saving}
          onClick={() => void saveKey()}
        >
          {saving ? "Saving…" : "Set as song key"}
        </Button>
      )}
      {message && <span className="text-xs text-zinc-600">{message}</span>}
      {error && <span className="text-xs text-zinc-600">{error}</span>}
    </div>
  );
}
