"use client";

import type { FormEvent } from "react";
import { deleteProject } from "./actions";

export function ConfirmProjectDelete({ projectId }: { projectId: string }) {
  const action = deleteProject.bind(null, projectId);
  return (
    <form
      action={action}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        if (!window.confirm("Delete this project and all shared content?")) {
          event.preventDefault();
        }
      }}
    >
      <button className="min-h-10 rounded-md border border-red-300 px-3 text-sm text-red-700 hover:bg-red-50">
        Delete project
      </button>
    </form>
  );
}
