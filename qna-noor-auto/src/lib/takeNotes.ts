export type TakeKind = "song" | "beat";

export function parseClock(value: string): number | null {
  const match = /^(\d+):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const milliseconds = (minutes * 60 + seconds) * 1000;
  return Number.isSafeInteger(milliseconds) ? milliseconds : null;
}

export function formatClock(atMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, atMs) / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function takeTargetIds(kind: TakeKind, takeId: string) {
  return kind === "song"
    ? { songTakeId: takeId, beatTakeId: null }
    : { songTakeId: null, beatTakeId: takeId };
}

export function hasExactlyOneTakeId(ids: {
  songTakeId: string | null;
  beatTakeId: string | null;
}): boolean {
  return Boolean(ids.songTakeId) !== Boolean(ids.beatTakeId);
}
