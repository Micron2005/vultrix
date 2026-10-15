"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button, Select } from "@/components/ui";
import { addSongMember } from "./actions";

type Connection = {
  id: string;
  handle: string;
  displayName: string;
};

export function SongInviteForm({
  songId,
  connections,
}: {
  songId: string;
  connections: Connection[];
}) {
  const [profileId, setProfileId] = useState(connections[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileId) return;
    setMessage("");
    startTransition(async () => {
      try {
        await addSongMember(songId, profileId);
        setMessage("Connection added to the song.");
      } catch {
        setMessage("Could not add this connection. Check the mutual connection and try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <Select
        value={profileId}
        onChange={(event) => setProfileId(event.currentTarget.value)}
        aria-label="Choose a mutual connection to invite"
        className="min-h-11 flex-1"
      >
        {connections.map((connection) => (
          <option key={connection.id} value={connection.id}>
            {connection.displayName} · @{connection.handle}
          </option>
        ))}
      </Select>
      <Button type="submit" disabled={pending || !profileId} className="min-h-11">
        {pending ? "Adding…" : "Invite"}
      </Button>
      {message && <p role="status" className="text-xs text-zinc-600 sm:self-center">{message}</p>}
    </form>
  );
}
