"use client";

import { useRef, useState } from "react";

const MAX_EDGE = 512;
const MAX_DATA_URL_LENGTH = 400_000;

function resizeLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      reject(new Error("Choose a PNG, JPEG, or WebP image."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Could not decode that image."));
      image.onload = () => {
        const scale = Math.min(
          1,
          MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Could not prepare that image."));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL(file.type, 0.86);
        if (dataUrl.length > MAX_DATA_URL_LENGTH) {
          reject(new Error("That image is too large after resizing."));
          return;
        }
        resolve(dataUrl);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ShopBranding({
  initialLogo,
  initialAccent,
}: {
  initialLogo: string | null;
  initialAccent: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState(initialLogo ?? "");
  const [accent, setAccent] = useState(initialAccent ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setLogo(await resizeLogo(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not use that image.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="shopLogo" value={logo} />
      <input type="hidden" name="shopAccent" value={accent} />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Shop logo preview" className="h-full w-full object-contain" />
          ) : (
            <span className="px-2 text-center text-[10px] text-zinc-400">No logo</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Upload logo
          </button>
          {logo && (
            <button
              type="button"
              onClick={() => {
                setLogo("");
                setError(null);
              }}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-zinc-700">
          Accent color
          <input
            type="color"
            value={accent || "#000000"}
            onChange={(event) => setAccent(event.target.value)}
            className="ml-2 inline-block h-8 w-12 cursor-pointer rounded border border-zinc-300 p-0.5 align-middle"
          />
        </label>
        {accent ? (
          <button
            type="button"
            onClick={() => setAccent("")}
            className="text-xs text-zinc-500 underline"
          >
            Clear accent
          </button>
        ) : (
          <span className="text-xs text-zinc-500">None</span>
        )}
        <span className="text-xs text-zinc-500">Used on customer portal actions only.</span>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
