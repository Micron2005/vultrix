import type { BeatData } from "./kits";

export function beatChroma(data: BeatData): number[] {
  const chroma = Array<number>(12).fill(0);
  const melodicTrackIds = new Set(
    data.tracks
      .filter((track) => track.kind !== "drums" && track.kind !== "machine")
      .map((track) => track.id),
  );

  for (const pattern of data.patterns) {
    for (const trackId of melodicTrackIds) {
      for (const note of pattern.notes[trackId] ?? []) {
        chroma[((note.note % 12) + 12) % 12] += note.len * note.vel;
      }
    }
  }
  return chroma;
}
