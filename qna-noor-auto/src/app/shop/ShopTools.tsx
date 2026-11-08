"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  addShopPhoto,
  deleteShopPhoto,
  moveShopPhoto,
  recordShopSale,
} from "./actions";
import { fileToResizedDataUrl } from "@/lib/imageResize";

export function ShopShareTools({
  url,
  qr,
  filename,
  title = "Shop",
}: {
  url: string;
  qr: string;
  filename: string;
  title?: string;
}) {
  const [message, setMessage] = useState("");
  const [showQr, setShowQr] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(url);
    setMessage("Copied");
  }
  async function share() {
    if (navigator.share) {
      await navigator.share({ title, url });
    } else {
      await copy();
    }
  }
  return (
    <div className="contents">
      <button type="button" onClick={copy} className="rounded border px-3 py-2 text-sm">Copy link</button>
      <button type="button" onClick={share} className="rounded border px-3 py-2 text-sm">Share</button>
      <button type="button" onClick={() => setShowQr((visible) => !visible)} aria-expanded={showQr} className="rounded border px-3 py-2 text-sm">
        {showQr ? "Hide QR" : "Show QR"}
      </button>
      <span aria-live="polite" className="text-xs text-zinc-500">{message}</span>
      {showQr && (
        <div className="flex w-full min-w-0 basis-full flex-wrap items-center gap-3">
          <img src={qr} alt="QR code for this shop link" className="size-24 rounded border bg-white p-1" />
          <a href={qr} download={filename} className="text-sm text-blue-700 underline">Download QR PNG</a>
        </div>
      )}
    </div>
  );
}

export function ShopFeedCopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        }}
        className="rounded border px-3 py-2 text-sm"
      >
        Copy feed URL
      </button>
      <span aria-live="polite" className="text-xs text-zinc-500">
        {copied ? "Copied" : ""}
      </span>
    </div>
  );
}

export function ShopItemActions({
  partId,
  unitPrice,
  defaultSoldAt,
  canLogSale,
  children,
}: {
  partId: string;
  unitPrice: number | null;
  defaultSoldAt: string;
  canLogSale: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState("Etsy");
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {children}
        {canLogSale && (
          <button
            type="button"
            onClick={() => setOpen((visible) => !visible)}
            aria-expanded={open}
            className="rounded border px-3 py-2 text-sm"
          >
            {open ? "Cancel sale" : "Log a sale from somewhere else"}
          </button>
        )}
      </div>
      {canLogSale && open && (
        <div className="w-full min-w-0 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold">Sold it somewhere else?</h4>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-zinc-600 underline"
            >
              Cancel
            </button>
          </div>
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">
            Made a sale on Etsy, at a market or in person? Log it here so your stock and sales stay right.
          </p>
          <form action={recordShopSale} className="min-w-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="hidden" name="partId" value={partId} />
            <label className="grid min-w-0 gap-1 text-sm">
              <span>Where</span>
              <select
                name="channel"
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
                className="w-full min-w-0 rounded border bg-transparent px-3 py-2"
              >
                <option value="Etsy">Etsy</option>
                <option value="Instagram">Instagram</option>
                <option value="Facebook">Facebook</option>
                <option value="TikTok">TikTok</option>
                <option value="Craft fair / market">Craft fair / market</option>
                <option value="In person">In person</option>
                <option value="Other">Other</option>
              </select>
            </label>
            {channel === "Other" && (
              <label className="grid min-w-0 gap-1 text-sm">
                <span>Other channel</span>
                <input
                  name="otherChannel"
                  required
                  maxLength={100}
                  className="w-full min-w-0 rounded border bg-transparent px-3 py-2"
                />
              </label>
            )}
            <label className="grid min-w-0 gap-1 text-sm">
              <span>Quantity</span>
              <input
                name="quantity"
                type="number"
                required
                min="1"
                step="1"
                defaultValue="1"
                className="w-full min-w-0 rounded border bg-transparent px-3 py-2"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-sm">
              <span>Price each</span>
              <input
                name="unitPrice"
                type="number"
                required
                min="0"
                step="0.01"
                defaultValue={unitPrice ?? 0}
                className="w-full min-w-0 rounded border bg-transparent px-3 py-2"
              />
            </label>
            <label className="grid min-w-0 gap-1 text-sm">
              <span>Date</span>
              <input
                name="soldAt"
                type="date"
                required
                defaultValue={defaultSoldAt}
                className="w-full min-w-0 rounded border bg-transparent px-3 py-2"
              />
            </label>
            <div className="flex min-w-0 items-end">
              <button className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white">
                Record sale
              </button>
            </div>
          </form>
        </div>
      )}
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
    <div className="min-w-0 space-y-2">
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
