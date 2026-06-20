"use client";

import { deleteLead } from "./actions";

/**
 * Small client wrapper so deleting a lead asks for confirmation first. The
 * actual delete runs as a server action (imported above).
 */
export function DeleteLead({ id }: { id: string }) {
  return (
    <form
      action={deleteLead}
      onSubmit={(e) => {
        if (!window.confirm("Delete this lead permanently? This can't be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline"
        data-testid={`delete-lead-${id}`}
      >
        Delete
      </button>
    </form>
  );
}
