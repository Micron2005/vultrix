"use client";

import { useState, useTransition } from "react";
import { fileToResizedDataUrl } from "@/lib/imageResize";
import { PROJECT_FILE_MAX_BYTES } from "@/lib/projects";
import { uploadProjectFile } from "./actions";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export function ProjectFileUploader({ projectId }: { projectId: string }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const input = form.elements.namedItem("file") as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        const isImage = file.type.startsWith("image/");
        if (!isImage && file.size > PROJECT_FILE_MAX_BYTES) {
          setError("Files must be 2 MB or smaller.");
          return;
        }
        setError("");
        startTransition(async () => {
          try {
            const mimeType = isImage ? "image/jpeg" : file.type;
            const dataUrl = mimeType === "image/jpeg"
              ? await fileToResizedDataUrl(file)
              : await fileToDataUrl(file);
            if (mimeType === "image/jpeg") {
              const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
              const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
              const sizeBytes = Math.floor((base64.length * 3) / 4) - padding;
              if (sizeBytes > PROJECT_FILE_MAX_BYTES) {
                setError("Resized images must be 2 MB or smaller.");
                return;
              }
            }
            const data = new FormData();
            data.set("name", file.name);
            data.set("mimeType", mimeType);
            data.set("dataUrl", dataUrl);
            await uploadProjectFile(projectId, data);
            form.reset();
          } catch {
            setError("Could not upload this file.");
          }
        });
      }}
    >
      <label className="min-w-0 flex-1 text-sm font-medium text-zinc-700">
        Add an image or PDF (2 MB max)
        <input
          className="mt-1 block w-full min-w-0 text-sm"
          type="file"
          name="file"
          accept="image/*,application/pdf"
          required
          disabled={pending}
        />
      </label>
      <button
        className="min-h-10 rounded-md bg-[var(--vx-accent-600)] px-3 text-sm font-medium text-[var(--vx-accent-fg)] disabled:opacity-50"
        type="submit"
        disabled={pending}
      >
        {pending ? "Uploading…" : "Upload"}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
