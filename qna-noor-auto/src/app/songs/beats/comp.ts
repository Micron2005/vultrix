import { z } from "zod";
import type { BeatDocument, BeatTakeAudio } from "./engine";
import { sectionSequence, stepsFor } from "./kits";

export const MAX_COMP_SLOTS = 300;

export const CompSchema = z.object({
  v: z.literal(1),
  slots: z
    .record(z.string().max(20), z.string().max(40).nullable())
    .refine((slots) => Object.keys(slots).length <= MAX_COMP_SLOTS),
});

export type Comp = z.infer<typeof CompSchema>;

export type CompSlot = {
  key: string;
  sectionIndex: number;
  repeat: number;
  name: string;
  startMs: number;
  endMs: number;
};

export type AutoFillTake = {
  id: string;
  offsetMs: number;
  trimStartMs: number;
  trimEndMs: number;
  durationSec: number;
  createdAt: string;
};

const emptyComp = (): Comp => ({ v: 1, slots: {} });

export function parseComp(raw: string | null): Comp {
  if (!raw) return emptyComp();

  try {
    const result = CompSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : emptyComp();
  } catch {
    return emptyComp();
  }
}

export function compSlots(document: BeatDocument): CompSlot[] {
  const stepDurationMs = (60 / document.bpm / 4) * 1000;
  let cursorMs = 0;

  return sectionSequence(document.data).map((entry) => {
    const startMs = cursorMs;
    cursorMs += stepsFor(entry.pattern) * stepDurationMs;
    return {
      key: `${entry.sectionIndex}:${entry.repeat}`,
      sectionIndex: entry.sectionIndex,
      repeat: entry.repeat,
      name:
        entry.section.repeats > 1
          ? `${entry.section.name} ×${entry.repeat + 1}`
          : entry.section.name,
      startMs,
      endMs: cursorMs,
    };
  });
}

export function compSegments(
  slots: CompSlot[],
  comp: Comp,
  takeId: string,
): Array<{ startMs: number; endMs: number }> {
  const segments = slots
    .filter((slot) => comp.slots[slot.key] === takeId)
    .map(({ startMs, endMs }) => ({ startMs, endMs }));

  return segments.reduce<Array<{ startMs: number; endMs: number }>>(
    (merged, segment) => {
      const previous = merged[merged.length - 1];
      if (previous && previous.endMs === segment.startMs) {
        previous.endMs = segment.endMs;
      } else {
        merged.push(segment);
      }
      return merged;
    },
    [],
  );
}

export function windowTake(
  audio: BeatTakeAudio,
  startMs: number,
  endMs: number,
): BeatTakeAudio | null {
  const bufferMs = audio.buffer.duration * 1000;
  const sourceStart = startMs - audio.offsetMs;
  const sourceEnd = endMs - audio.offsetMs;
  const trimStartMs = Math.max(audio.trimStartMs, sourceStart);
  const trimEndMs = Math.max(audio.trimEndMs, bufferMs - sourceEnd);

  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs <= startMs ||
    bufferMs - trimStartMs - trimEndMs <= 0
  ) {
    return null;
  }

  return { ...audio, trimStartMs, trimEndMs, fadeMs: 15 };
}

export function autoFillComp(slots: CompSlot[], takes: AutoFillTake[]): Comp {
  const newestFirst = [...takes].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const assignments: Comp["slots"] = {};

  for (const slot of slots.slice(0, MAX_COMP_SLOTS)) {
    const slotDuration = slot.endMs - slot.startMs;
    const take = newestFirst.find((candidate) => {
      const takeStart = candidate.offsetMs + candidate.trimStartMs;
      const takeEnd =
        candidate.offsetMs +
        candidate.durationSec * 1000 -
        candidate.trimEndMs;
      const overlap = Math.max(
        0,
        Math.min(slot.endMs, takeEnd) - Math.max(slot.startMs, takeStart),
      );
      return slotDuration > 0 && overlap / slotDuration >= 0.8;
    });
    assignments[slot.key] = take?.id ?? null;
  }

  return { v: 1, slots: assignments };
}
