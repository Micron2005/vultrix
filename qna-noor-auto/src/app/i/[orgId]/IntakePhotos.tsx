"use client";

import { useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { MAX_INTAKE_PHOTOS } from "./intake-photo-constants";

const MAX_EDGE = 1600; // px — longest side after resize
const JPEG_QUALITY = 0.72;

/**
 * Resize/compress an image file in the browser to a small JPEG data URL before
 * it's submitted with the intake form. Keeps stored photos light and avoids any
 * external object storage (same approach as repair-order photos).
 */
function fileToResizedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Optional photo picker for the public intake flow. The selected images are
 * resized client-side and serialized into a hidden `photos` field so they ride
 * along with the existing "Create ticket" server-action form submit.
 */
export function IntakePhotos() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_INTAKE_PHOTOS - photos.length;

  async function handleFiles(fileList: FileList | null) {
    setError(null);
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length === 0) {
      setError("Please choose image files only.");
      return;
    }
    if (files.length > remaining) {
      setError(`You can add up to ${MAX_INTAKE_PHOTOS} photos.`);
      return;
    }
    setBusy(true);
    try {
      const next: string[] = [];
      for (const f of files) next.push(await fileToResizedDataUrl(f));
      setPhotos((prev) => [...prev, ...next]);
    } catch {
      setError("Couldn't read one of those images. Try another.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(i: number) {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div data-testid="intake-photos">
      <label className="mb-1 block text-sm font-medium text-zinc-700">
        Photos (optional)
      </label>
      <p className="mb-2 text-xs text-zinc-500">
        Add photos of the problem, damage, warning lights, or the part.
      </p>

      {/* Serialized payload submitted with the form */}
      <input type="hidden" name="photos" value={JSON.stringify(photos)} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        data-testid="intake-photos-input"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="grid grid-cols-3 gap-2">
        {photos.map((src, i) => (
          <div
            key={i}
            className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Attached photo ${i + 1}`}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
              data-testid="intake-photo-remove"
              aria-label={`Remove photo ${i + 1}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {remaining > 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 text-zinc-500 transition-colors hover:border-zinc-900 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="intake-photos-add"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
            <span className="text-xs">{busy ? "Adding…" : "Add"}</span>
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-1 text-sm text-red-600" data-testid="intake-photos-error">
          {error}
        </p>
      ) : null}
      {photos.length > 0 ? (
        <p className="mt-1 text-xs text-zinc-400">
          {photos.length} photo{photos.length === 1 ? "" : "s"} attached
        </p>
      ) : null}
    </div>
  );
}
