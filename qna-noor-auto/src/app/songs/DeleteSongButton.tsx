"use client";

import { Button } from "@/components/ui";

export function DeleteSongButton({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Delete this song?")) {
          event.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="danger">Delete song</Button>
    </form>
  );
}
