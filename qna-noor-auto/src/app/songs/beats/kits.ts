import { z } from "zod";

export const BEAT_TRACKS = [
  "kick",
  "snare",
  "clap",
  "chh",
  "ohh",
  "tom",
  "rim",
  "perc",
] as const;

export const DRUM_VOICES = BEAT_TRACKS;
export type BeatTrack = (typeof BEAT_TRACKS)[number];
export type BeatKit = "808" | "Acoustic" | "Lo-fi";
export const MELODIC_INSTRUMENTS = ["bass", "piano", "eguitar", "aguitar"] as const;
export type MelodicInstrument = (typeof MELODIC_INSTRUMENTS)[number];
export type TrackKind = "drums" | MelodicInstrument;

export const MELODIC_LABELS: Record<MelodicInstrument, string> = {
  bass: "Bass",
  piano: "Piano",
  eguitar: "Electric guitar",
  aguitar: "Acoustic guitar",
};

export const KITS = ["808", "Acoustic", "Lo-fi"] as const satisfies readonly BeatKit[];

const stepArray = z.array(z.number().int().min(0).max(2)).length(16);
const noteSchema = z.object({
  step: z.number().int().min(0).max(63),
  note: z.number().int().min(24).max(96),
  len: z.number().int().min(1).max(64),
  vel: z.number().min(0.1).max(1.5).default(1),
});
const trackSchema = z.object({
  id: z.string().min(1).max(32),
  kind: z.enum(["drums", ...MELODIC_INSTRUMENTS]),
  name: z.string().min(1).max(40),
  volume: z.number().min(0).max(1.5).default(1),
  pan: z.number().min(-1).max(1).default(0),
});
const drumsSchema = z
  .object(
    Object.fromEntries(
      BEAT_TRACKS.map((track) => [
        track,
        z.array(z.number().int().min(0).max(2)).min(16).max(64),
      ]),
    ) as Record<BeatTrack, z.ZodArray<z.ZodNumber>>,
  )
  .strict();
const patternV2Schema = z.object({
  id: z.string().min(1).max(32),
  name: z.string().min(1).max(40),
  bars: z.union([z.literal(1), z.literal(2), z.literal(4)]).default(1),
  drums: z.record(z.string(), drumsSchema),
  notes: z.record(z.string(), z.array(noteSchema).max(256)),
});

export const BeatDataV2Schema = z.object({
  v: z.literal(2),
  tracks: z.array(trackSchema).min(1).max(16),
  patterns: z.array(patternV2Schema).min(1).max(16),
  chain: z.array(z.string().min(1).max(32)).max(64),
});

const notesV1Schema = z.object({
  notes: z
    .array(
      z.object({
        step: z.number().int().min(0).max(15),
        note: z.number().int().min(24).max(96),
        len: z.number().int().min(1).max(16),
      }),
    )
    .max(128),
});

export const BeatDataV1Schema = z.object({
  v: z.literal(1),
  patterns: z
    .array(
      z.object({
        id: z.string().min(1).max(32),
        name: z.string().min(1).max(40),
        steps: z
          .object(
            Object.fromEntries(BEAT_TRACKS.map((track) => [track, stepArray])) as Record<
              BeatTrack,
              typeof stepArray
            >,
          )
          .strict(),
      }),
    )
    .min(1)
    .max(16),
  chain: z.array(z.string().min(1).max(32)).max(64),
  bass: notesV1Schema,
  piano: notesV1Schema.default({ notes: [] }),
  eguitar: notesV1Schema.default({ notes: [] }),
  aguitar: notesV1Schema.default({ notes: [] }),
});

export type BeatDataV1 = z.infer<typeof BeatDataV1Schema>;
export type BeatDataV2 = z.infer<typeof BeatDataV2Schema>;
export type BeatData = BeatDataV2;
export type BeatPattern = BeatData["patterns"][number];
export type BeatNote = BeatPattern["notes"][string][number];
export type BeatTrackInstance = BeatData["tracks"][number];

export function stepsFor(pattern: BeatPattern) {
  return pattern.bars * 16;
}

function generatedId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyPattern(
  tracks: BeatData["tracks"],
  name: string,
  bars: 1 | 2 | 4 = 1,
): BeatPattern {
  const length = bars * 16;
  return {
    id: generatedId("pattern"),
    name,
    bars,
    drums: Object.fromEntries(
      tracks
        .filter((track) => track.kind === "drums")
        .map((track) => [
          track.id,
          Object.fromEntries(
            BEAT_TRACKS.map((voice) => [voice, Array.from({ length }, () => 0)]),
          ) as BeatPattern["drums"][string],
        ]),
    ),
    notes: Object.fromEntries(
      tracks
        .filter((track) => track.kind !== "drums")
        .map((track) => [track.id, []]),
    ),
  };
}

export function migrateBeatData(data: BeatDataV1 | BeatData): BeatData {
  if (data.v === 2) return data;
  const melodicTracks = MELODIC_INSTRUMENTS
    .filter((kind) => kind !== "bass")
    .filter((kind) => data[kind].notes.length > 0)
    .map((kind) => ({
      id: kind,
      kind,
      name: MELODIC_LABELS[kind],
      volume: 1,
      pan: 0,
    }));
  const tracks: BeatData["tracks"] = [
    { id: "drums", kind: "drums", name: "Drums", volume: 1, pan: 0 },
    { id: "bass", kind: "bass", name: "Bass", volume: 1, pan: 0 },
    ...melodicTracks,
  ];
  return {
    v: 2,
    tracks,
    patterns: data.patterns.map((pattern) => ({
      id: pattern.id,
      name: pattern.name,
      bars: 1,
      drums: { drums: pattern.steps },
      notes: Object.fromEntries(
        MELODIC_INSTRUMENTS.map((kind) => [
          kind,
          data[kind].notes.map((note) => ({ ...note, vel: 1 })),
        ]),
      ),
    })),
    chain: data.chain,
  };
}

export const BeatDataSchema = z
  .union([BeatDataV2Schema, BeatDataV1Schema])
  .transform(migrateBeatData);

const defaultTracks: BeatData["tracks"] = [
  { id: "drums", kind: "drums", name: "Drums", volume: 1, pan: 0 },
  { id: "bass", kind: "bass", name: "Bass", volume: 1, pan: 0 },
];
const defaultPattern = emptyPattern(defaultTracks, "A");
defaultPattern.drums.drums.kick[0] = 1;
defaultPattern.drums.drums.kick[8] = 1;

export const DEFAULT_BEAT_DATA: BeatData = {
  v: 2,
  tracks: defaultTracks,
  patterns: [defaultPattern],
  chain: [],
};

export function noteName(midi: number) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export const KIT_CONFIG = {
  "808": {
    kickDecay: 0.42,
    snareDecay: 0.18,
    hatDecay: 0.055,
    lowpass: 12000,
    detune: 0,
  },
  Acoustic: {
    kickDecay: 0.22,
    snareDecay: 0.24,
    hatDecay: 0.08,
    lowpass: 16000,
    detune: 0,
  },
  "Lo-fi": {
    kickDecay: 0.28,
    snareDecay: 0.14,
    hatDecay: 0.045,
    lowpass: 4200,
    detune: -8,
  },
} as const satisfies Record<BeatKit, {
  kickDecay: number;
  snareDecay: number;
  hatDecay: number;
  lowpass: number;
  detune: number;
}>;
