"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function DeleteIdeaButton({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      action={async (formData) => {
        if (!window.confirm("Delete this idea?")) return;
        setBusy(true);
        try {
          await action(formData);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Button type="submit" variant="ghost" size="sm" disabled={busy}>
        Delete
      </Button>
    </form>
  );
}
