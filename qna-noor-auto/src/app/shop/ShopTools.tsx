"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addShopPhoto, deleteShopPhoto, moveShopPhoto } from "./actions";
import { fileToResizedDataUrl } from "@/lib/imageResize";

export function ShopShareTools({
  url,
  qr,
  filename,
}: {
  url: string;
  qr: string;
  filename: string;
}) {
  const [message, setMessage] = useState("");
  async function copy() {
    await navigator.clipboard.writeText(url);
    setMessage("Copied");
  }
  async function share() {
    if (navigator.share) {
      await navigator.share({ title: "Shop", url });
    } else {
      await copy();
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={copy} className="rounded border px-3 py-2 text-sm">Copy link</button>
      <button type="button" onClick={share} className="rounded border px-3 py-2 text-sm">Share</button>
      <img src={qr} alt="Shop QR code" className="size-24 rounded border bg-white p-1" />
      <a href={qr} download={filename} className="text-sm text-blue-700 underline">Download QR PNG</a>
      <span aria-live="polite" className="text-xs text-zinc-500">{message}</span>
    </div>
  );
}

export function CopyAddressButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }}
      className="rounded border px-3 py-2 text-sm"
    >
      {copied ? "Copied" : "Copy address"}
    </button>
  );
}

export function ShopPhotoManager({
  partId,
  photos,
}: {
  partId: string;
  photos: Array<{ id: string; position: number }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await addShopPhoto(partId, await fileToResizedDataUrl(file, 1200));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function mutate(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <div key={photo.id} className="flex items-center gap-1 rounded border p-1">
            <span className="text-xs">Photo {index + 1}</span>
            <button type="button" disabled={busy || index === 0} onClick={() => mutate(() => moveShopPhoto(photo.id, -1))} aria-label="Move photo earlier">↑</button>
            <button type="button" disabled={busy || index === photos.length - 1} onClick={() => mutate(() => moveShopPhoto(photo.id, 1))} aria-label="Move photo later">↓</button>
            <button type="button" disabled={busy} onClick={() => mutate(() => deleteShopPhoto(photo.id))} className="text-red-700" aria-label="Delete photo">×</button>
          </div>
        ))}
      </div>
      {photos.length < 6 && (
        <label className="inline-block cursor-pointer rounded border px-3 py-2 text-sm">
          {busy ? "Uploading…" : "Add photo"}
          <input type="file" accept="image/*" disabled={busy} className="sr-only" onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        </label>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
