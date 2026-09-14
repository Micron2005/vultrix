import { LinkButton, PageHeader } from "@/components/ui";
import { createSong } from "../actions";
import { requireMusicPack } from "@/lib/songs";
import { SongForm } from "../SongForm";

export default async function NewSongPage() {
  await requireMusicPack();
  return (
    <>
      <PageHeader title="New song" actions={<LinkButton href="/songs" variant="secondary">Cancel</LinkButton>} />
      <SongForm action={createSong} />
    </>
  );
}
