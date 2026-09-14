"use client";

import { Button } from "@/components/ui";

export function ForgetEverythingForm({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Forget every saved memory?")) {
          event.preventDefault();
        }
      }}
      className="px-6 pb-6"
    >
      <Button type="submit" variant="danger">
        Forget everything
      </Button>
    </form>
  );
}
