"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.72;
const MAX_RECEIPTS = 5;
const MAX_IMAGE_DATA_URL_LENGTH = 4_000_000;

export type ExpenseReceiptItem = {
  id?: string;
  dataUrl: string;
};

function fileToResizedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ExpenseReceipts({
  initialReceipts = [],
}: {
  initialReceipts?: ExpenseReceiptItem[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ExpenseReceiptItem[]>(initialReceipts);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const selected = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (!selected.length) {
      setError("Please choose image files only.");
      return;
    }
    if (items.length + selected.length > MAX_RECEIPTS) {
      setError(`You can attach up to ${MAX_RECEIPTS} receipt photos.`);
      return;
    }
    setBusy(true);
    try {
      const added: ExpenseReceiptItem[] = [];
      let skippedOversize = false;
      for (const file of selected) {
        const dataUrl = await fileToResizedDataUrl(file);
        if (dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
          skippedOversize = true;
          continue;
        }
        added.push({ dataUrl });
      }
      setItems((current) => [...current, ...added]);
      if (skippedOversize) {
        setError("Some receipt photos were too large and were skipped.");
      }
    } catch {
      setError("Something went wrong reading those images. Try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
      {error && <p className="text-xs text-red-700">{error}</p>}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {items.map((item, index) => (
            <div
              key={`${item.id ?? item.dataUrl.slice(0, 24)}-${index}`}
              className="group relative aspect-square overflow-hidden rounded-md border border-zinc-200 bg-zinc-100"
            >
              <button
                type="button"
                onClick={() => setLightbox(item.dataUrl)}
                className="block h-full w-full"
                aria-label="View receipt photo"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.dataUrl}
                  alt="Expense receipt"
                  className="h-full w-full object-cover"
                />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setItems((current) => current.filter((_, i) => i !== index));
                }}
                className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-600 opacity-0 shadow-sm group-hover:opacity-100"
                aria-label="Remove receipt photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        disabled={busy || items.length >= MAX_RECEIPTS}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-md border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
      >
        <ImagePlus className="h-4 w-4" />
        {busy ? "Preparing…" : "Add receipt photos"}
      </button>
      <input type="hidden" name="receipts" value={JSON.stringify(items)} />
      {lightbox && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Expense receipt"
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
