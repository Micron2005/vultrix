export type FocusPackId = "music" | "study" | "tech" | "fitness" | "creator";

export type FocusPack = {
  id: FocusPackId;
  label: string;
  blurb: string;
  noteCategories: string[];
};

export const FOCUS_PACKS: FocusPack[] = [
  {
    id: "music",
    label: "Music",
    blurb: "Writing, producing, and releasing songs.",
    noteCategories: ["Lyrics", "Melody ideas", "Mix notes", "References"],
  },
  {
    id: "study",
    label: "Study & education",
    blurb: "Keep classes, reading, and assignments moving.",
    noteCategories: ["Lecture notes", "Flashcards", "Reading", "Assignments"],
  },
  {
    id: "tech",
    label: "Tech & building",
    blurb: "Capture snippets, architecture, bugs, and learnings.",
    noteCategories: ["Snippets", "Architecture", "Bugs", "Learnings"],
  },
  {
    id: "fitness",
    label: "Fitness & health",
    blurb: "Stay consistent with workouts, nutrition, and PRs.",
    noteCategories: ["Workouts", "Nutrition", "PRs"],
  },
  {
    id: "creator",
    label: "Creator & content",
    blurb: "Plan content, partnerships, and audience growth.",
    noteCategories: ["Content ideas", "Scripts", "Brand deals", "Analytics"],
  },
];

const PACK_IDS = new Set<string>(FOCUS_PACKS.map((pack) => pack.id));

export function normalizeFocusPacks(raw: unknown): FocusPackId[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<FocusPackId>();
  for (const value of raw) {
    if (typeof value !== "string" || !PACK_IDS.has(value)) continue;
    seen.add(value as FocusPackId);
  }
  return FOCUS_PACKS.map((pack) => pack.id).filter((id) => seen.has(id));
}

export function hasPack(
  packs: readonly string[],
  id: FocusPackId,
): boolean {
  return packs.includes(id);
}

export function noteCategoriesFor(packs: readonly string[]): string[] {
  const selected = new Set(packs);
  return FOCUS_PACKS.flatMap((pack) =>
    selected.has(pack.id) ? pack.noteCategories : [],
  );
}
