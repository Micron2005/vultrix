"use client";

import { Button } from "@/components/ui";
import { leaveSong } from "./actions";

export function LeaveSongButton({ songId }: { songId: string }) {
  return (
    <form
      action={leaveSong.bind(null, songId)}
      onSubmit={(event) => {
        if (!window.confirm("Leave this shared song? Your beats linked to it will be unlinked.")) {
          event.preventDefault();
        }
      }}
    >
      <Button type="submit" size="sm" variant="danger">Leave song</Button>
    </form>
  );
}
