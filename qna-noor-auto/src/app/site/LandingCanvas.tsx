"use client";

import { useRef, useState, useCallback } from "react";
import { updateBlock, deleteBlock, createBlock } from "./actions";

type Block = {
  id: string;
  type: string;
  content: string;
  imageData: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  sortOrder: number;
};

export function LandingCanvas({
  blocks,
  editable,
}: {
  blocks: Block[];
  editable: boolean;
}) {
  if (!editable) {
    return <ReadOnlyCanvas blocks={blocks} />;
  }
  return <EditableCanvas blocks={blocks} />;
}

/* ────── Read-only (public) view ────── */
function ReadOnlyCanvas({ blocks }: { blocks: Block[] }) {
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-6">
      {blocks.map((block) => (
        <div key={block.id}>
          {block.type === "HEADING" && (
            <h2 className="text-2xl font-bold text-zinc-900">{block.content}</h2>
          )}
          {block.type === "TEXT" && (
            <div className="text-zinc-700 leading-relaxed whitespace-pre-wrap">
              {block.content}
            </div>
          )}
          {block.type === "IMAGE" && block.imageData && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/api/landing-image/${block.id}`}
              alt=""
              className="rounded-lg max-w-full"
              style={{ width: block.width || undefined }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ────── Editable (admin) view ────── */
function EditableCanvas({ blocks }: { blocks: Block[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, id: string) => {
      setDragId(id);
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, id: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (id !== dragOverId) setDragOverId(id);
    },
    [dragOverId],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      setDragOverId(null);
      if (!dragId || dragId === targetId) {
        setDragId(null);
        return;
      }
      const ids = blocks.map((b) => b.id);
      const fromIdx = ids.indexOf(dragId);
      const toIdx = ids.indexOf(targetId);
      if (fromIdx < 0 || toIdx < 0) return;
      ids.splice(fromIdx, 1);
      ids.splice(toIdx, 0, dragId);
      setDragId(null);
      const { reorderBlocks } = await import("./actions");
      await reorderBlocks(ids);
    },
    [dragId, blocks],
  );

  const handleAddText = useCallback(async () => {
    await createBlock({ type: "TEXT", content: "Click to edit this text..." });
  }, []);

  const handleAddHeading = useCallback(async () => {
    await createBlock({ type: "HEADING", content: "New heading" });
  }, []);

  const handleAddImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        await createBlock({
          type: "IMAGE",
          imageData: dataUrl,
          width: 600,
          height: 400,
        });
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [],
  );

  const handleSaveContent = useCallback(
    async (id: string, content: string) => {
      await updateBlock(id, { content });
      setEditingId(null);
    },
    [],
  );

  const handleDelete = useCallback(async (id: string) => {
    await deleteBlock(id);
  }, []);

  const handleReplaceImage = useCallback(
    (blockId: string) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          await updateBlock(blockId, { imageData: dataUrl });
        };
        reader.readAsDataURL(file);
      };
      input.click();
    },
    [],
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
        <span className="text-xs font-medium text-zinc-500 mr-2">Add:</span>
        <button
          onClick={handleAddHeading}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          + Heading
        </button>
        <button
          onClick={handleAddText}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          + Text
        </button>
        <button
          onClick={handleAddImage}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          + Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        <div className="ml-auto text-xs text-zinc-400">
          Drag blocks to reorder
        </div>
      </div>

      {/* Blocks */}
      <div className="space-y-4">
        {blocks.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-zinc-300 p-12 text-center text-zinc-400">
            Use the toolbar above to add headings, text, and images.
          </div>
        )}
        {blocks.map((block) => (
          <div
            key={block.id}
            draggable
            onDragStart={(e) => handleDragStart(e, block.id)}
            onDragOver={(e) => handleDragOver(e, block.id)}
            onDragEnd={() => {
              setDragId(null);
              setDragOverId(null);
            }}
            onDrop={(e) => handleDrop(e, block.id)}
            className={
              "group relative rounded-lg border bg-white p-4 transition-colors " +
              (dragOverId === block.id
                ? "border-blue-400 bg-blue-50"
                : "border-zinc-200 hover:border-zinc-300") +
              (dragId === block.id ? " opacity-50" : "")
            }
          >
            {/* Drag handle + actions */}
            <div className="absolute -left-1 top-2 flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="cursor-grab rounded p-1 text-zinc-400 hover:text-zinc-600">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="5" cy="3" r="1.5" />
                  <circle cx="11" cy="3" r="1.5" />
                  <circle cx="5" cy="8" r="1.5" />
                  <circle cx="11" cy="8" r="1.5" />
                  <circle cx="5" cy="13" r="1.5" />
                  <circle cx="11" cy="13" r="1.5" />
                </svg>
              </div>
            </div>
            <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {block.type === "IMAGE" && (
                <button
                  onClick={() => handleReplaceImage(block.id)}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                  title="Replace image"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => handleDelete(block.id)}
                className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                title="Delete"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            {/* Block content */}
            {block.type === "HEADING" && (
              editingId === block.id ? (
                <EditableInput
                  value={block.content}
                  onSave={(val) => handleSaveContent(block.id, val)}
                  onCancel={() => setEditingId(null)}
                  className="text-2xl font-bold text-zinc-900"
                />
              ) : (
                <h2
                  className="text-2xl font-bold text-zinc-900 cursor-text"
                  onClick={() => setEditingId(block.id)}
                >
                  {block.content || "Click to edit..."}
                </h2>
              )
            )}
            {block.type === "TEXT" && (
              editingId === block.id ? (
                <EditableTextarea
                  value={block.content}
                  onSave={(val) => handleSaveContent(block.id, val)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div
                  className="text-zinc-700 leading-relaxed whitespace-pre-wrap cursor-text"
                  onClick={() => setEditingId(block.id)}
                >
                  {block.content || "Click to edit..."}
                </div>
              )
            )}
            {block.type === "IMAGE" && block.imageData && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`/api/landing-image/${block.id}`}
                alt=""
                className="rounded-lg max-w-full"
                style={{ width: block.width || undefined }}
              />
            )}
            {block.type === "IMAGE" && !block.imageData && (
              <div
                className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 text-zinc-400 cursor-pointer"
                onClick={() => handleReplaceImage(block.id)}
              >
                Click to upload an image
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────── Inline editing helpers ────── */

function EditableInput({
  value,
  onSave,
  onCancel,
  className,
}: {
  value: string;
  onSave: (val: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const [text, setText] = useState(value);
  return (
    <input
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onSave(text)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSave(text);
        if (e.key === "Escape") onCancel();
      }}
      className={`w-full border-none outline-none bg-transparent ${className ?? ""}`}
    />
  );
}

function EditableTextarea({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (val: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);
  return (
    <div>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        rows={Math.max(3, text.split("\n").length + 1)}
        className="w-full rounded-md border border-zinc-300 p-2 text-sm text-zinc-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-zinc-400"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => onSave(text)}
          className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
