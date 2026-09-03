export type GoalTemplateAccountType = "AUTO_SHOP" | "BUSINESS" | "PERSONAL";

export type GoalTemplate = {
  id: string;
  title: string;
  blurb: string;
  accountTypes: Array<GoalTemplateAccountType>;
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
): GoalTemplate[] {
  return GOAL_TEMPLATES.flatMap((template) => {
    if (!template.accountTypes.includes(accountType)) return [];
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
