"use client";

import { deleteStatusIncident } from "../actions";

export function DeleteStatusIncident({ id }: { id: string }) {
  return (
    <form
      action={deleteStatusIncident}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Delete this incident permanently? This can't be undone.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-xs text-red-600 hover:text-red-700 hover:underline"
      >
        Delete
      </button>
    </form>
  );
}
