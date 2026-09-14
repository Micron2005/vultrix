import { LinkButton, PageHeader } from "@/components/ui";
import { requireMusicPack, listSongs } from "@/lib/songs";
import { moveSong } from "./actions";
import { SongsBoard } from "./SongsBoard";

export default async function SongsPage() {
  const { orgId } = await requireMusicPack();
  const songs = await listSongs(orgId);
  return (
    <>
      <PageHeader
        title="Songs"
        description="Every song from idea to release."
        actions={<LinkButton href="/songs/new">New song</LinkButton>}
      />
      <SongsBoard songs={songs} moveSongAction={moveSong} />
    </>
  );
}
