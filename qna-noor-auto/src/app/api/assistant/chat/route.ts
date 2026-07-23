import { z } from "zod";
import { db } from "@/lib/db";
import { decryptAiApiKey, isAiKeyEncryptionConfigured } from "@/lib/ai-key-crypto";
import {
  addAssistantCalendarEvent,
  addAssistantExpense,
  addAssistantIncome,
  addAssistantNote,
  adjustAssistantInventory,
  createAssistantInventoryPart,
  getAssistantFinancialSummary,
  getAssistantInventoryOverview,
  getAssistantReportsSummary,
  getAssistantUpcomingEvents,
  readAssistantNote,
  removeAssistantCalendarEvent,
  updateAssistantNote,
  type AddCalendarEventArgs,
  type AddExpenseArgs,
  type AddIncomeArgs,
  type AddNoteArgs,
  type AdjustInventoryArgs,
  type AssistantContext,
  type CreateInventoryPartArgs,
  type PeriodArgs,
  type ReportsSummaryArgs,
  type ReadNoteArgs,
  type RemoveCalendarEventArgs,
  type UpcomingEventsArgs,
  type UpdateNoteArgs,
} from "@/lib/assistant";
import {
  runAssistantProvider,
  type AssistantMessage,
  type AssistantProvider,
  type AssistantToolDefinition,
  type AssistantToolName,
} from "@/lib/assistant/providers";
import {
  runAssistantConversation,
  type ProviderCaller,
} from "@/lib/assistant/conversation";
import { describeNow } from "@/lib/assistant/datetime";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  timezone: z.string().trim().min(1).max(64).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .max(20)
    .default([]),
});

const property = (type: string, description?: string) => ({
  type,
  ...(description ? { description } : {}),
});

const NL_DATE_HINT =
  "Accepts natural language (e.g. 'tomorrow at 9am', 'next Friday', 'in 2 hours') or an ISO date/time — the current date/time is given in the system prompt.";

const tools: AssistantToolDefinition[] = [
  {
    name: "create_inventory_part",
    description:
      "Add a brand-new inventory item, optionally with opening stock, cost, price, and storage location. For an existing item, use adjust_inventory instead.",
    parameters: {
      type: "object",
      properties: {
        name: property("string", "Part name"),
        partNumber: property("string"),
        category: property("string"),
        unit: property("string"),
        cost: property("number", "Cost per unit, optional"),
        price: property("number", "Selling price per unit, optional"),
        location: property("string", "Storage location, optional"),
        openingQuantity: property("number", "Opening quantity, default 0"),
        reorderLevel: property("number", "Low-stock threshold, default 0"),
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "adjust_inventory",
    description:
      "Add or remove inventory by part name or ID. Use this for an existing item; if the name is new, it creates the item without blocking.",
    parameters: {
      type: "object",
      properties: {
        partId: property("string"),
        partName: property("string"),
        delta: property("number", "Positive to add, negative to remove"),
        note: property("string"),
      },
      required: ["delta"],
      additionalProperties: false,
    },
  },
  {
    name: "add_income",
    description: "Log received income for a non-invoice financials account.",
    parameters: {
      type: "object",
      properties: {
        amount: property("number"),
        receivedAt: property("string", `Date received. ${NL_DATE_HINT}`),
        source: property("string", "Income source"),
        frequency: property("string", "ONE_TIME, WEEKLY, BIWEEKLY, or MONTHLY"),
        note: property("string"),
      },
      required: ["amount", "source"],
      additionalProperties: false,
    },
  },
  {
    name: "add_expense",
    description: "Log an expense.",
    parameters: {
      type: "object",
      properties: {
        amount: property("number"),
        paidAt: property("string", `Date paid. ${NL_DATE_HINT}`),
        category: property("string"),
        vendor: property("string"),
        reference: property("string"),
        method: property("string"),
        note: property("string"),
      },
      required: ["amount"],
      additionalProperties: false,
    },
  },
  {
    name: "add_note",
    description:
      "Save a Knowledge note (an idea, reminder, or piece of information). If the user did not give a title, omit it — the note is still saved and you should then ask what to call it.",
    parameters: {
      type: "object",
      properties: {
        title: property("string", "Optional. Omit if the user hasn't named it."),
        details: property("string", "The note body / what to remember"),
        tags: property("string", "Comma-separated tags"),
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "update_note",
    description:
      "Rename or add details to an existing note — e.g. after saving an untitled note and the user tells you what to call it. If no noteId is given, the most recently touched note is used.",
    parameters: {
      type: "object",
      properties: {
        noteId: property("string", "Optional id of the note to update"),
        title: property("string", "New title"),
        details: property("string", "New or additional details"),
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "read_note",
    description: "Read a Knowledge note by title.",
    parameters: {
      type: "object",
      properties: {
        title: property("string", "Note title"),
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "add_calendar_event",
    description: "Add a calendar event or reminder.",
    parameters: {
      type: "object",
      properties: {
        title: property("string"),
        startsAt: property("string", `When it starts. ${NL_DATE_HINT}`),
        endsAt: property("string", `When it ends, optional. ${NL_DATE_HINT}`),
        allDay: property("boolean"),
        isReminder: property("boolean"),
        notes: property("string"),
      },
      required: ["title", "startsAt"],
      additionalProperties: false,
    },
  },
  {
    name: "remove_calendar_event",
    description: "Remove an upcoming calendar event by title.",
    parameters: {
      type: "object",
      properties: {
        title: property("string", "Event title"),
        date: property("string", `Date of the event, optional. ${NL_DATE_HINT}`),
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "get_financial_summary",
    description: "Read money in, money out, and net for a period.",
    parameters: {
      type: "object",
      properties: {
        from: property("string", `Period start, optional. ${NL_DATE_HINT}`),
        to: property("string", `Period end, optional. ${NL_DATE_HINT}`),
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_inventory_overview",
    description: "Read inventory quantities and low-stock parts.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_upcoming_events",
    description: "Read upcoming calendar events.",
    parameters: {
      type: "object",
      properties: {
        from: property("string", `Start of the window, optional. ${NL_DATE_HINT}`),
        limit: property("number", "Maximum 50, default 10"),
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_reports_summary",
    description: "Read repair reports, revenue, expenses, profit, and receivables.",
    parameters: {
      type: "object",
      properties: {
        from: property("string", `Period start, optional. ${NL_DATE_HINT}`),
        to: property("string", `Period end, optional. ${NL_DATE_HINT}`),
      },
      additionalProperties: false,
    },
  },
];

const providerSchema = z.enum(["OLLAMA", "OPENAI", "ANTHROPIC"]);
const MAX_TOOL_ITERATIONS = 6;

function friendlyError(error: unknown): string {
  if (error instanceof z.ZodError) {
    const first = error.issues[0];
    const field = first?.path?.join(".") ?? "";
    return field
      ? `I still need the "${field}" for that. Could you tell me?`
      : "I still need a bit more information for that. Could you clarify?";
  }
  const message = error instanceof Error ? error.message : "";
  if (
    message.includes("ECONNREFUSED") ||
    message.includes("fetch failed") ||
    message.includes("Provider returned")
  ) {
    return "I couldn't reach the assistant service right now. Please try again shortly.";
  }
  return message || "I couldn't complete that request.";
}

async function executeTool(
  orgId: string,
  ctx: AssistantContext,
  name: AssistantToolName,
  args: unknown,
): Promise<{ confirmation: string; result: unknown }> {
  try {
    const finish = (output: { confirmation: string; data: unknown }) => ({
      confirmation: output.confirmation,
      result: output.data,
    });
    switch (name) {
      case "create_inventory_part":
        return finish(await createAssistantInventoryPart(
          orgId,
          args as CreateInventoryPartArgs,
        ));
      case "adjust_inventory":
        return finish(await adjustAssistantInventory(
          orgId,
          args as AdjustInventoryArgs,
        ));
      case "add_income":
        return finish(await addAssistantIncome(orgId, args as AddIncomeArgs, ctx));
      case "add_expense":
        return finish(await addAssistantExpense(orgId, args as AddExpenseArgs, ctx));
      case "add_note":
        return finish(await addAssistantNote(orgId, args as AddNoteArgs));
      case "update_note":
        return finish(await updateAssistantNote(orgId, args as UpdateNoteArgs));
      case "read_note":
        return finish(await readAssistantNote(orgId, args as ReadNoteArgs));
      case "add_calendar_event":
        return finish(await addAssistantCalendarEvent(
          orgId,
          args as AddCalendarEventArgs,
          ctx,
        ));
      case "remove_calendar_event":
        return finish(await removeAssistantCalendarEvent(
          orgId,
          args as RemoveCalendarEventArgs,
          ctx,
        ));
      case "get_financial_summary":
        return finish(await getAssistantFinancialSummary(orgId, args as PeriodArgs, ctx));
      case "get_inventory_overview":
        return finish(await getAssistantInventoryOverview(orgId));
      case "get_upcoming_events":
        return finish(await getAssistantUpcomingEvents(
          orgId,
          args as UpcomingEventsArgs,
          ctx,
        ));
      case "get_reports_summary":
        return finish(await getAssistantReportsSummary(
          orgId,
          args as ReportsSummaryArgs,
          ctx,
        ));
    }
  } catch (error) {
    const message = friendlyError(error);
    return { confirmation: message, result: { error: message } };
  }
}

function buildSystemPrompt(assistantName: string, timezone: string, now: Date): string {
  return [
    `You are ${assistantName}, a friendly, knowledgeable AI assistant.`,
    `The current date and time is ${describeNow(timezone, now)}. Use it to resolve relative dates like "tomorrow" or "next week".`,
    "",
    "You do two things well:",
    "1. Have a normal, helpful conversation — answer questions, explain things, brainstorm, help with writing, planning, coding, and ideas, just like a capable general assistant.",
    "2. Take actions in the user's app using the available tools.",
    "",
    "Guidelines:",
    "- For general questions or chit-chat, just reply naturally. Do NOT call a tool unless the user wants to read or change their own data.",
    "- When the user does want to read or change their data (inventory, income, expenses, calendar, notes, reports), call the matching tool instead of pretending.",
    "- Act on clear requests right away; you may pass natural-language dates/times to tools (they're resolved against the current time above).",
    "- After a tool runs, confirm what happened briefly and naturally, in your own words. Never claim success if a tool returned an error.",
    "- If a tool reports it's missing information, ask the user for exactly that one thing in a friendly way — never dead-end with a generic error.",
    "",
    "Notes flow:",
    "- Use add_note / read_note / update_note only for saving or reading the user's notes, ideas, or reminders. Never store inventory, income, expense, or calendar items as notes — use their own tools.",
    "- If the user asks to save a note but hasn't given a title, call add_note WITHOUT a title. When it returns needsTitle, ask the user what they'd like to call it.",
    "- When the user then gives a title, call update_note to set it. If they say they don't know or don't care, reassure them: \"No problem — you can always add a title later,\" and move on.",
    "",
    "Inventory phrasing:",
    "- \"Used\", \"used up\", \"ran out of\", \"finished\", \"sold\", \"broke\", or \"threw out\" means adjust_inventory with a NEGATIVE delta. \"Got\", \"bought\", \"received\", or \"restocked\" means a POSITIVE delta.",
    "- Apply inventory changes immediately without waiting for cost or storage details. Use adjust_inventory for an existing item and create_inventory_part for a new item when cost, price, or location are given. Never ask for a reason or who received the item.",
  ].join("\n");
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.orgId) return Response.json({ error: "Organization required" }, { status: 403 });

  const org = await db.organization.findUnique({
    where: { id: user.orgId },
    select: {
      accountType: true,
      aiAssistantEnabled: true,
      aiHostedEnabled: true,
      aiAssistantName: true,
      aiAssistantProvider: true,
      aiAssistantApiKeyEncrypted: true,
    },
  });
  if (!org || org.accountType !== "PERSONAL" || !org.aiAssistantEnabled) {
    return Response.json({ error: "Assistant is not enabled" }, { status: 403 });
  }

  const providerResult = providerSchema.safeParse(org.aiAssistantProvider);
  if (!providerResult.success) {
    return Response.json({ error: "Assistant backend is invalid" }, { status: 500 });
  }
  const provider: AssistantProvider = providerResult.data;
  if (provider === "OLLAMA" && !org.aiHostedEnabled) {
    return Response.json({
      reply:
        "Hosted AI is not active on this account. Enable the hosted AI add-on in Billing, or add your own OpenAI or Anthropic key in Settings.",
      steps: [],
    });
  }
  let apiKey: string | undefined;
  if (provider !== "OLLAMA") {
    if (!org.aiAssistantApiKeyEncrypted || !isAiKeyEncryptionConfigured()) {
      return Response.json(
        { error: "Own-key backend is not configured" },
        { status: 503 },
      );
    }
    try {
      apiKey = decryptAiApiKey(org.aiAssistantApiKeyEncrypted);
    } catch {
      return Response.json(
        { error: "Own-key backend is unavailable" },
        { status: 503 },
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  const timezone = parsed.data.timezone ?? "UTC";
  const now = new Date();
  const ctx: AssistantContext = { timezone, now };

  const messages: AssistantMessage[] = [
    ...parsed.data.history,
    { role: "user", content: parsed.data.message },
  ];

  const systemPrompt = buildSystemPrompt(org.aiAssistantName, timezone, now);
  const model =
    provider === "OLLAMA"
      ? process.env.OLLAMA_MODEL ?? "llama3.1:8b"
      : provider === "OPENAI"
        ? "gpt-4o-mini"
        : "claude-3-5-haiku-latest";

  const callProvider: ProviderCaller = (conversationMessages) =>
    runAssistantProvider({
      provider,
      apiKey,
      model,
      systemPrompt,
      messages: conversationMessages,
      tools,
    });

  try {
    const { reply, steps } = await runAssistantConversation({
      callProvider,
      executeTool: (name, args) =>
        executeTool(user.orgId as string, ctx, name as AssistantToolName, args),
      messages,
      maxIterations: MAX_TOOL_ITERATIONS,
    });
    return Response.json({ reply, steps });
  } catch (error) {
    return Response.json({ reply: friendlyError(error), steps: [] });
  }
}
