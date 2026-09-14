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

export type BeatTrack = (typeof BEAT_TRACKS)[number];
export type BeatKit = "808" | "Acoustic" | "Lo-fi";

export const KITS = ["808", "Acoustic", "Lo-fi"] as const satisfies readonly BeatKit[];

const stepArray = z.array(z.number().int().min(0).max(2)).length(16);

export const BeatDataSchema = z.object({
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
  bass: z.object({
    notes: z
      .array(
        z.object({
          step: z.number().int().min(0).max(15),
          note: z.number().int().min(24).max(96),
          len: z.number().int().min(1).max(16),
        }),
      )
      .max(128),
  }),
});

export type BeatData = z.infer<typeof BeatDataSchema>;
export type BeatPattern = BeatData["patterns"][number];

export const DEFAULT_BEAT_DATA: BeatData = {
  v: 1,
  patterns: [
    {
      id: "pattern-a",
      name: "A",
      steps: Object.fromEntries(
        BEAT_TRACKS.map((track) => [
          track,
          Array.from({ length: 16 }, (_, step) =>
            track === "kick" && (step === 0 || step === 8) ? 1 : 0,
          ),
        ]),
      ) as BeatPattern["steps"],
    },
  ],
  chain: [],
  bass: { notes: [] },
};

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
