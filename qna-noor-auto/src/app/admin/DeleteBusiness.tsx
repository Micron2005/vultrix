"use client";

import { useState } from "react";
import { deleteBusiness } from "./actions";

/**
 * Delete a business and all its data. Hidden behind a disclosure plus a
 * typed-name confirmation so it can never happen by accident — the Delete
 * button only enables once the operator types the exact business name.
 */
export function DeleteBusiness({
  orgId,
  name,
}: {
  orgId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-red-600 hover:text-red-700 hover:underline"
      >
        Delete business…
      </button>
    );
  }

  return (
    <form action={deleteBusiness} className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
      <input type="hidden" name="orgId" value={orgId} />
      <p className="text-xs text-red-700">
        This permanently deletes <strong>{name}</strong> and all of its data
        (logins, customers, vehicles, tickets, payments, inventory). This cannot
        be undone. Type the business name to confirm.
      </p>
      <input
        name="confirmName"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={name}
        autoComplete="off"
        className="w-full rounded-md border border-red-300 px-3 py-1.5 text-sm placeholder:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-400"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={typed.trim() !== name}
          className="inline-flex items-center justify-center rounded-md font-medium h-8 px-3 text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none"
        >
          Delete permanently
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          className="inline-flex items-center justify-center rounded-md font-medium h-8 px-3 text-sm bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
