"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * Delete control for the repair-order detail page. Requires the user to expand
 * the control and type DELETE before the (soft) delete server action fires, so
 * a stray click can't remove a ticket. Deleting is now reversible from Trash,
 * but the typed confirmation keeps it deliberate.
 */
export function DeleteROButton({
  action,
  roNumber,
}: {
  action: (fd: FormData) => void | Promise<void>;
  roNumber: number;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  if (!open) {
    return (
      <Button
        type="button"
        variant="danger"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid="delete-ro-open"
      >
        Delete RO
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2" data-testid="delete-ro-form">
      <span className="text-xs text-zinc-600">
        Type <code className="font-mono font-semibold">DELETE</code> to remove RO #{roNumber}{" "}
        <span className="text-zinc-400">(restorable from Trash)</span>
      </span>
      <input
        name="confirm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        autoComplete="off"
        placeholder="DELETE"
        className="h-8 w-24 rounded border border-zinc-300 px-2 text-xs focus:border-red-500 focus:outline-none"
        data-testid="delete-ro-confirm-input"
      />
      <Button
        type="submit"
        variant="danger"
        size="sm"
        disabled={text.trim() !== "DELETE"}
        data-testid="delete-ro-confirm"
      >
        Confirm delete
      </Button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setText("");
        }}
        className="text-xs text-zinc-500 underline hover:text-zinc-700"
        data-testid="delete-ro-cancel"
      >
        Cancel
      </button>
    </form>
  );
}
