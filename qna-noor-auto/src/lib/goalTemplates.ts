import type { FocusPackId } from "@/lib/focusPacks";

export type GoalTemplateAccountType = "AUTO_SHOP" | "BUSINESS" | "PERSONAL";
export type GoalTemplate = {
  id: string;
  title: string;
  blurb: string;
  accountTypes: Array<GoalTemplateAccountType>;
  pack?: FocusPackId;
  shape: "number" | "task";
  goal?: {
    metric: string;
    period: "WEEK" | "MONTH" | "YEAR";
    target: number;
    direction?: "AT_LEAST" | "AT_MOST";
    unit?: string;
  };
  routine?: {
    kind: "DAILY" | "WEEKDAYS" | "WEEKLY";
    weekdays?: string;
    items: string[];
    dueTime?: string;
    showStreak?: boolean;
  };
};

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: "shop-weekly-revenue",
    title: "Weekly revenue",
    blurb: "Money in from paid invoices this week.",
    accountTypes: ["AUTO_SHOP"],
    shape: "number",
    goal: { metric: "MONEY_IN", period: "WEEK", target: 5000 },
  },
  {
    id: "shop-cars-per-week",
    title: "Cars out the door",
    blurb: "Jobs completed this week.",
    accountTypes: ["AUTO_SHOP"],
    shape: "number",
    goal: { metric: "JOBS", period: "WEEK", target: 25 },
  },
  {
    id: "shop-monthly-profit",
    title: "Monthly profit",
    blurb: "Revenue minus expenses.",
    accountTypes: ["AUTO_SHOP"],
    shape: "number",
    goal: { metric: "PROFIT", period: "MONTH", target: 10000 },
  },
  {
    id: "shop-opening",
    title: "Opening checklist",
    blurb: "Same routine every morning.",
    accountTypes: ["AUTO_SHOP"],
    shape: "task",
    routine: {
      kind: "WEEKDAYS",
      weekdays: "1,2,3,4,5,6",
      dueTime: "09:00",
      items: [
        "Unlock and lights on",
        "Check lifts and air compressor",
        "Review today's appointments",
        "Count the drawer",
      ],
    },
  },
  {
    id: "shop-closing",
    title: "Closing checklist",
    blurb: "Close out the shop every evening.",
    accountTypes: ["AUTO_SHOP"],
    shape: "task",
    routine: {
      kind: "WEEKDAYS",
      weekdays: "1,2,3,4,5,6",
      dueTime: "18:00",
      items: ["Lock bays and tool room", "Count the drawer", "Set tomorrow's schedule"],
    },
  },
  {
    id: "shop-estimate-followups",
    title: "Follow up on open estimates",
    blurb: "Call or text anyone who hasn't approved yet.",
    accountTypes: ["AUTO_SHOP"],
    shape: "task",
    routine: {
      kind: "DAILY",
      items: ["Follow up on open estimates"],
    },
  },
  {
    id: "biz-monthly-sales",
    title: "Monthly sales",
    blurb: "Money in from this month's sales.",
    accountTypes: ["BUSINESS"],
    shape: "number",
    goal: { metric: "MONEY_IN", period: "MONTH", target: 10000 },
  },
  {
    id: "biz-units",
    title: "Items sold this month",
    blurb: "Track the number of items sold.",
    accountTypes: ["BUSINESS"],
    shape: "number",
    goal: { metric: "UNITS_SOLD", period: "MONTH", target: 100 },
  },
  {
    id: "biz-spend-cap",
    title: "Keep spending under",
    blurb: "Keep this month's spending within your budget.",
    accountTypes: ["BUSINESS"],
    shape: "number",
    goal: {
      metric: "SPENDING",
      period: "MONTH",
      target: 3000,
      direction: "AT_MOST",
    },
  },
  {
    id: "biz-posts",
    title: "Post 5 times this week",
    blurb: "For creators and sellers: count your posts by hand.",
    accountTypes: ["BUSINESS"],
    shape: "number",
    goal: { metric: "MANUAL", period: "WEEK", target: 5, unit: "posts" },
  },
  {
    id: "biz-daily-followups",
    title: "Daily follow-ups",
    blurb: "Keep conversations and leads moving.",
    accountTypes: ["BUSINESS"],
    shape: "task",
    routine: {
      kind: "DAILY",
      items: ["Reply to every message", "Follow up with leads", "Post one update"],
    },
  },
  {
    id: "biz-weekly-review",
    title: "Weekly review",
    blurb: "Take a regular look at the business.",
    accountTypes: ["BUSINESS"],
    shape: "task",
    routine: {
      kind: "WEEKLY",
      items: ["Look at the numbers", "Plan next week"],
    },
  },
  {
    id: "me-save",
    title: "Save this month",
    blurb: "Put money aside this month.",
    accountTypes: ["PERSONAL"],
    shape: "number",
    goal: { metric: "NET_SAVED", period: "MONTH", target: 500 },
  },
  {
    id: "me-spend-cap",
    title: "Spend under",
    blurb: "Keep this month's spending under control.",
    accountTypes: ["PERSONAL"],
    shape: "number",
    goal: {
      metric: "SPENDING",
      period: "MONTH",
      target: 1500,
      direction: "AT_MOST",
    },
  },
  {
    id: "me-workout",
    title: "Work out 3× a week",
    blurb: "Build a consistent workout habit.",
    accountTypes: ["PERSONAL"],
    shape: "task",
    routine: {
      kind: "WEEKDAYS",
      weekdays: "1,3,5",
      showStreak: true,
      items: ["Workout"],
    },
  },
  {
    id: "me-read",
    title: "Read 20 minutes",
    blurb: "Make time for reading every day.",
    accountTypes: ["PERSONAL"],
    shape: "task",
    routine: {
      kind: "DAILY",
      showStreak: true,
      items: ["Read 20 minutes"],
    },
  },
  {
    id: "me-water",
    title: "Drink water",
    blurb: "Remember to drink eight glasses each day.",
    accountTypes: ["PERSONAL"],
    shape: "task",
    routine: {
      kind: "DAILY",
      items: ["Drink 8 glasses"],
    },
  },
  {
    id: "me-weekly-plan",
    title: "Plan the week",
    blurb: "Start each week with a clear plan.",
    accountTypes: ["PERSONAL"],
    shape: "task",
    routine: {
      kind: "WEEKLY",
      items: ["Plan the week", "Check the budget"],
    },
  },
  {
    id: "me-side-hustle",
    title: "Sell 10 things this month",
    blurb: "Side hustles and informal selling.",
    accountTypes: ["PERSONAL"],
    shape: "number",
    goal: { metric: "UNITS_SOLD", period: "MONTH", target: 10 },
  },
  {
    id: "music-practice-hours",
    title: "Practice 5 hours a week",
    blurb: "Track your timed music practice.",
    accountTypes: ["PERSONAL"],
    pack: "music",
    shape: "number",
    goal: {
      metric: "practice_minutes",
      period: "WEEK",
      target: 300,
      unit: "min",
    },
  },
  {
    id: "music-practice",
    title: "Practice 30 minutes",
    blurb: "Build a daily music practice habit.",
    accountTypes: ["PERSONAL"],
    pack: "music",
    shape: "task",
    routine: {
      kind: "DAILY",
      showStreak: true,
      items: ["Practice 30 minutes"],
    },
  },
  {
    id: "music-finish-demo",
    title: "Finish one demo",
    blurb: "Move one song from idea to demo each week.",
    accountTypes: ["PERSONAL"],
    pack: "music",
    shape: "task",
    routine: {
      kind: "WEEKLY",
      items: ["Finish one demo"],
    },
  },
  {
    id: "study-hour",
    title: "Study 1 hour",
    blurb: "Make focused study time part of every day.",
    accountTypes: ["PERSONAL"],
    pack: "study",
    shape: "task",
    routine: { kind: "DAILY", items: ["Study 1 hour"] },
  },
  {
    id: "study-flashcards",
    title: "Review flashcards",
    blurb: "Keep your recall practice consistent on weekdays.",
    accountTypes: ["PERSONAL"],
    pack: "study",
    shape: "task",
    routine: { kind: "WEEKDAYS", items: ["Review flashcards"] },
  },
  {
    id: "tech-commit",
    title: "Ship one commit",
    blurb: "Make a small, meaningful change every day.",
    accountTypes: ["PERSONAL"],
    pack: "tech",
    shape: "task",
    routine: { kind: "DAILY", items: ["Ship one commit"] },
  },
  {
    id: "tech-learning",
    title: "Write up what I learned",
    blurb: "Turn weekly learning into reusable notes.",
    accountTypes: ["PERSONAL"],
    pack: "tech",
    shape: "task",
    routine: { kind: "WEEKLY", items: ["Write up what I learned"] },
  },
  {
    id: "fitness-workout",
    title: "Workout",
    blurb: "Follow a simple daily workout sequence.",
    accountTypes: ["PERSONAL"],
    pack: "fitness",
    shape: "task",
    routine: {
      kind: "DAILY",
      items: ["Warm up", "Main set", "Stretch"],
    },
  },
  {
    id: "fitness-water",
    title: "Drink 8 glasses of water",
    blurb: "Stay hydrated every day.",
    accountTypes: ["PERSONAL"],
    pack: "fitness",
    shape: "task",
    routine: { kind: "DAILY", items: ["Drink 8 glasses of water"] },
  },
  {
    id: "creator-post",
    title: "Post today",
    blurb: "Keep your publishing rhythm moving.",
    accountTypes: ["PERSONAL"],
    pack: "creator",
    shape: "task",
    routine: { kind: "WEEKDAYS", items: ["Post today"] },
  },
  {
    id: "creator-plan",
    title: "Plan next week's content",
    blurb: "Start the next week with a clear content plan.",
    accountTypes: ["PERSONAL"],
    pack: "creator",
    shape: "task",
    routine: { kind: "WEEKLY", items: ["Plan next week's content"] },
  },
];

export function normalizeGoalTemplateAccountType(
  accountType: string,
): GoalTemplateAccountType {
  if (accountType === "PERSONAL" || accountType === "BUSINESS") {
    return accountType;
  }
  return "AUTO_SHOP";
}

export function templatesFor(
  accountType: GoalTemplateAccountType,
  allowedMetric: (metric: string) => boolean,
  focusPacks: readonly string[] = [],
): GoalTemplate[] {
  return GOAL_TEMPLATES.flatMap((template) => {
    if (!template.accountTypes.includes(accountType)) return [];
    if (template.pack && !focusPacks.includes(template.pack)) return [];
    if (!template.goal || allowedMetric(template.goal.metric)) return [template];
    if (template.id !== "me-side-hustle") return [];
    return [
      {
        ...template,
        goal: {
          metric: "MANUAL",
          period: template.goal.period,
          target: template.goal.target,
          unit: "sales",
        },
      },
    ];
  });
}
