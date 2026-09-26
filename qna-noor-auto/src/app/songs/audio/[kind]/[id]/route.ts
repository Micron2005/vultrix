import { requireMusicPack } from "@/lib/songs";
import { db } from "@/lib/db";

function decodeAudioDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^,]+),([\s\S]+)$/);
  if (!match) return null;
  return {
    mimeType: match[1].split(";")[0],
    bytes: Buffer.from(match[2], "base64"),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const { orgId } = await requireMusicPack();
  const { kind, id } = await params;
  if (kind !== "beat" && kind !== "song") {
    return new Response("Not found", { status: 404 });
  }
  const take =
    kind === "beat"
      ? await db.beatTake.findFirst({
          where: { id, orgId, uploadComplete: true },
          select: { audioDataUrl: true, audioMimeType: true },
        })
      : await db.songVocalTake.findFirst({
          where: { id, orgId, uploadComplete: true },
          select: { audioDataUrl: true, audioMimeType: true },
        });
  if (!take) return new Response("Not found", { status: 404 });
  const audio = decodeAudioDataUrl(take.audioDataUrl);
  if (!audio) return new Response("Invalid audio", { status: 500 });
  return new Response(new Uint8Array(audio.bytes), {
    headers: {
      "Content-Type": take.audioMimeType || audio.mimeType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
