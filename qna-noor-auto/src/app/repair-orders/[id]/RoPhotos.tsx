"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ImagePlus, Trash2, X, Loader2 } from "lucide-react";
import { addRoPhotos, deleteRoPhoto } from "./photo-actions";
import { MAX_PHOTOS_PER_RO } from "./photo-constants";

export type RoPhoto = { id: string; dataUrl: string; caption: string | null };

const MAX_EDGE = 1600; // px — longest side after resize
const JPEG_QUALITY = 0.72;

/**
 * Resize/compress an image file in the browser to a reasonably small JPEG data
 * URL before upload. Keeps stored photos light (insurance docs don't need full
 * sensor resolution) and avoids any external object storage.
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

export function RoPhotos({
  repairOrderId,
  photos,
  canDelete = true,
}: {
  repairOrderId: string;
  photos: RoPhoto[];
  canDelete?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const remaining = MAX_PHOTOS_PER_RO - photos.length;
  const working = busy || pending;

  async function handleFiles(fileList: FileList | null) {
    setError(null);
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) {
      setError("Please choose image files only.");
      return;
    }
    if (files.length > remaining) {
      setError(`You can add ${remaining} more photo${remaining === 1 ? "" : "s"} to this repair order.`);
      return;
    }

    setBusy(true);
    try {
      const items = [];
      for (const f of files) {
        const dataUrl = await fileToResizedDataUrl(f);
        items.push({ dataUrl });
      }
      const res = await addRoPhotos(repairOrderId, items);
      if (!res.ok) {
        setError(res.error ?? "Couldn't upload those photos.");
      } else {
        startTransition(() => router.refresh());
      }
    } catch {
      setError("Something went wrong reading those images. Try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDelete(id: string) {
    setError(null);
    setBusy(true);
    deleteRoPhoto(id)
      .then((res) => {
        if (!res.ok) setError(res.error ?? "Couldn't delete that photo.");
        else startTransition(() => router.refresh());
      })
      .finally(() => setBusy(false));
  }

  const showPrevious = useCallback(() => {
    setLightboxIndex((current) =>
      current === null || photos.length < 2
        ? current
        : (current - 1 + photos.length) % photos.length,
    );
  }, [photos.length]);

  const showNext = useCallback(() => {
    setLightboxIndex((current) =>
      current === null || photos.length < 2
        ? current
        : (current + 1) % photos.length,
    );
  }, [photos.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxIndex, showNext, showPrevious]);

  const lightboxPhoto =
    lightboxIndex === null ? null : photos[lightboxIndex] ?? null;

  return (
    <div className="p-4" data-testid="ro-photos">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        data-testid="ro-photos-input"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && (
        <div
          className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          data-testid="ro-photos-error"
        >
          {error}
        </div>
      )}

      {photos.length === 0 ? (
        <button
          type="button"
          disabled={working}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          data-testid="ro-photos-dropzone"
          className={
            "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors disabled:opacity-60 " +
            (dragOver
              ? "border-amber-400 bg-amber-50"
              : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100")
          }
        >
          {working ? (
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          ) : (
            <ImagePlus className="h-6 w-6 text-zinc-400" />
          )}
          <span className="text-sm font-medium text-zinc-700">
            {working ? "Uploading…" : "Add before/after photos"}
          </span>
          <span className="text-xs text-zinc-500">
            Tap to take a photo or choose files. Great for insurance claims.
          </span>
        </button>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-500">
              {photos.length} of {MAX_PHOTOS_PER_RO} photos
            </span>
            {remaining > 0 && (
              <button
                type="button"
                disabled={working}
                onClick={() => inputRef.current?.click()}
                data-testid="ro-photos-add-more"
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                {working ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5" />
                )}
                Add photos
              </button>
            )}
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={
              "grid grid-cols-3 gap-2 rounded-lg sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 " +
              (dragOver ? "ring-2 ring-amber-400" : "")
            }
            data-testid="ro-photos-grid"
          >
            {photos.map((p, i) => (
              <div
                key={p.id}
                className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100"
              >
                <button
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="block h-full w-full"
                  data-testid="ro-photo-thumb"
                  aria-label="View photo"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.dataUrl}
                    alt={p.caption ?? "Repair order photo"}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                </button>
                <span className="absolute bottom-1 left-1 z-20 rounded bg-black/60 px-1.5 text-[10px] text-white">
                  {i + 1}
                </span>
                {canDelete && (
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => handleDelete(p.id)}
                    data-testid="ro-photo-delete"
                    aria-label="Delete photo"
                    className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-red-600 opacity-100 shadow-sm transition-opacity [@media(hover:hover)]:opacity-0 hover:bg-white group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {p.caption && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[11px] text-white">
                    {p.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightboxIndex(null)}
          onTouchStart={(event) => {
            touchStartX.current = event.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const startX = touchStartX.current;
            touchStartX.current = null;
            if (startX === null) return;
            const endX = event.changedTouches[0]?.clientX;
            if (endX === undefined) return;
            const deltaX = endX - startX;
            if (Math.abs(deltaX) <= 40) return;
            if (deltaX > 0) showPrevious();
            else showNext();
          }}
          data-testid="ro-photo-lightbox"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute left-4 top-4 text-sm text-zinc-200">
            {lightboxIndex! + 1} / {photos.length}
          </div>
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Close"
            data-testid="ro-photo-lightbox-close"
          >
            <X className="h-5 w-5" />
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  showPrevious();
                }}
                className="absolute left-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  showNext();
                }}
                className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Next photo"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
          <figure
            className="max-h-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxPhoto.dataUrl}
              alt={lightboxPhoto.caption ?? "Repair order photo"}
              className="max-h-[80vh] w-auto rounded-lg object-contain"
            />
            {lightboxPhoto.caption && (
              <figcaption className="mt-2 text-center text-sm text-zinc-200">
                {lightboxPhoto.caption}
              </figcaption>
            )}
          </figure>
        </div>
      )}
    </div>
  );
}
