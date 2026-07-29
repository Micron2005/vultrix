"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function NoteGallery({
  images,
}: {
  images: { dataUrl: string; caption: string | null }[];
}) {
  const [lightbox, setLightbox] = useState<{ dataUrl: string; caption: string | null } | null>(null);
  if (!images.length) return null;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((image, index) => (
          <button
            key={`${image.dataUrl.slice(0, 20)}-${index}`}
            type="button"
            onClick={() => setLightbox(image)}
            className="aspect-square overflow-hidden rounded-md border border-zinc-200 bg-zinc-100"
            aria-label="View note image"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.dataUrl} alt={image.caption ?? "Note attachment"} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {lightbox && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)} role="dialog" aria-modal="true">
          <button type="button" onClick={() => setLightbox(null)} className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.dataUrl} alt={lightbox.caption ?? "Note attachment"} className="max-h-[90vh] max-w-full object-contain" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </>
  );
}
