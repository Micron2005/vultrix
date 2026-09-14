export const SONG_STAGES = [
  { id: "IDEA", label: "Idea" },
  { id: "WRITING", label: "Writing" },
  { id: "DEMO", label: "Demo" },
  { id: "RECORDING", label: "Recording" },
  { id: "MIX", label: "Mix" },
  { id: "MASTER", label: "Master" },
  { id: "RELEASED", label: "Released" },
] as const;

export type SongStage = (typeof SONG_STAGES)[number]["id"];
