"use client";

import { Button } from "@/components/ui";

export function ConfirmClearAllButton({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Clear all notifications?")) {
          event.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="danger">
        Clear all
      </Button>
    </form>
  );
}
