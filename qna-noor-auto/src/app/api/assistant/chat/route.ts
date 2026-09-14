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
  getAssistantSong,
  getAssistantSongs,
  getAssistantUpcomingEvents,
  logAssistantPractice,
  readAssistantNote,
  removeAssistantCalendarEvent,
  saveAssistantSongLyrics,
  setAssistantLyricNote,
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
  type AssistantResult,
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
import { friendlyError } from "@/lib/assistant/errors";
import { listMemories, rememberMemory, forgetMemory } from "@/lib/assistant/memory";
import { buildAssistantSystemPrompt } from "@/lib/assistant/prompt";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const OPENAI_MODEL =
  process.env.ASSISTANT_OPENAI_MODEL?.trim() || "gpt-4o";
const ANTHROPIC_MODEL =
  process.env.ASSISTANT_ANTHROPIC_MODEL?.trim() ||
  "claude-3-5-sonnet-latest";

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
  "Pass the user's words as-is (e.g. 'tomorrow at 9 in the morning'); do not convert to ISO yourself. Accepts natural language (e.g. 'tomorrow at 9am', 'next Friday', 'in 2 hours') or an ISO date/time — the current date/time is given in the system prompt.";

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
        category: property("string", "Optional note category"),
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
        category: property("string", "New note category"),
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

const memoryTools: AssistantToolDefinition[] = [
  {
    name: "remember",
    description: "Save a useful fact or preference about the user. Never store passwords, keys, or card numbers.",
    parameters: {
      type: "object",
      properties: {
        content: property("string", "The fact or preference to remember"),
        category: property("string", "preference, fact, project, or other"),
      },
      required: ["content"],
      additionalProperties: false,
    },
  },
  {
    name: "forget",
    description: "Forget memories matching a word or phrase, or a specific memory ID.",
    parameters: {
      type: "object",
      properties: { query: property("string"), id: property("string") },
      additionalProperties: false,
    },
  },
  {
    name: "list_memories",
    description: "List what you remember about the user when they ask what you know about them.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
];

const musicTools: AssistantToolDefinition[] = [
  {
    name: "get_songs",
    description: "List the user's songs and their stage, key, BPM, lyrics status, task progress, and latest practice date.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_song",
    description: "Load a specific song's real metadata, tasks, lyrics, lyric notes, ideas, practice totals, and attached beats before advising.",
    parameters: {
      type: "object",
      properties: { id: property("string"), title: property("string") },
      additionalProperties: false,
    },
  },
  {
    name: "save_song_lyrics",
    description: "Only after the user has approved the exact lyrics you propose; show them first.",
    parameters: {
      type: "object",
      properties: {
        id: property("string"),
        title: property("string"),
        lyrics: property("string"),
      },
      required: ["lyrics"],
      additionalProperties: false,
    },
  },
  {
    name: "set_lyric_note",
    description: "Save a pronunciation, phrasing, or performance note on an exact lyric line.",
    parameters: {
      type: "object",
      properties: {
        id: property("string"),
        title: property("string"),
        line: property("string"),
        note: property("string"),
      },
      required: ["line", "note"],
      additionalProperties: false,
    },
  },
  {
    name: "log_practice",
    description: "Log a completed practice session.",
    parameters: {
      type: "object",
      properties: {
        minutes: property("number"),
        songId: property("string"),
        songTitle: property("string"),
        bpm: property("number"),
        notes: property("string"),
      },
      required: ["minutes"],
      additionalProperties: false,
    },
  },
];

const providerSchema = z.enum(["OPENAI", "ANTHROPIC"]);
const MAX_TOOL_ITERATIONS = 6;

async function executeTool(
  orgId: string,
  ctx: AssistantContext,
  name: AssistantToolName,
  args: unknown,
  canViewFinancials: boolean,
  accountType: string | null,
  userId: string,
  memoryEnabled: boolean,
  musicEnabled: boolean,
): Promise<{
  confirmation: string;
  result: unknown;
  link?: { href: string; label: string };
}> {
  try {
    const finish = (output: AssistantResult<unknown>) => ({
      confirmation: output.confirmation,
      result: output.data,
      ...(output.link ? { link: output.link } : {}),
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
        if (!canViewFinancials || accountType === "AUTO_SHOP") {
          throw new Error("Income logging is not available for auto-shop accounts");
        }
        return finish(await addAssistantIncome(orgId, args as AddIncomeArgs, ctx));
      case "add_expense":
        if (!canViewFinancials) throw new Error("You don't have permission to do that");
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
        if (!canViewFinancials) throw new Error("You don't have permission to do that");
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
        if (!canViewFinancials) throw new Error("You don't have permission to do that");
        return finish(await getAssistantReportsSummary(
          orgId,
          args as ReportsSummaryArgs,
          ctx,
        ));
      case "remember":
        if (!memoryEnabled) throw new Error("Assistant memory is disabled.");
        {
          const input = args as { content: string; category?: string };
          const saved = await rememberMemory(orgId, userId, {
            ...input,
            source: "ASSISTANT",
          });
          return {
            confirmation: saved.deduped ? "Remembered." : "Remembered.",
            result: saved,
          };
        }
      case "forget":
        if (!memoryEnabled) throw new Error("Assistant memory is disabled.");
        {
          const { count } = await forgetMemory(
            orgId,
            userId,
            args as { id?: string; query?: string },
          );
          return {
            confirmation: `Forgot ${count} memor${count === 1 ? "y" : "ies"}.`,
            result: { count },
          };
        }
      case "list_memories":
        if (!memoryEnabled) throw new Error("Assistant memory is disabled.");
        {
          const memories = await listMemories(orgId, userId);
          return {
            confirmation: `I remember ${memories.length} thing${memories.length === 1 ? "" : "s"} about you.`,
            result: memories.map(({ id, content, category, source, updatedAt }) => ({
              id,
              content,
              category,
              source,
              updatedAt,
            })),
          };
        }
      case "get_songs":
        if (!musicEnabled) throw new Error("Music tools are not available.");
        return finish(await getAssistantSongs(orgId));
      case "get_song":
        if (!musicEnabled) throw new Error("Music tools are not available.");
        return finish(await getAssistantSong(
          orgId,
          args as { id?: string; title?: string },
        ));
      case "save_song_lyrics":
        if (!musicEnabled) throw new Error("Music tools are not available.");
        {
          const input = args as { id?: string; title?: string; lyrics: string };
          return finish(await saveAssistantSongLyrics(
            orgId,
            { id: input.id, title: input.title },
            input.lyrics,
          ));
        }
      case "set_lyric_note":
        if (!musicEnabled) throw new Error("Music tools are not available.");
        {
          const input = args as {
            id?: string;
            title?: string;
            line: string;
            note: string;
          };
          return finish(await setAssistantLyricNote(
            orgId,
            { id: input.id, title: input.title },
            input.line,
            input.note,
          ));
        }
      case "log_practice":
        if (!musicEnabled) throw new Error("Music tools are not available.");
        {
          const input = args as {
            minutes: number;
            songId?: string;
            songTitle?: string;
            bpm?: number;
            notes?: string;
          };
          return finish(await logAssistantPractice(
            orgId,
            input.minutes,
            input.songId || input.songTitle
              ? { id: input.songId, title: input.songTitle }
              : undefined,
            input.bpm,
            input.notes,
          ));
        }
    }
  } catch (error) {
    console.error("[assistant] provider error", error);
    const message = friendlyError(error);
    return { confirmation: message, result: { error: message } };
  }
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
      aiAssistantName: true,
      aiAssistantProvider: true,
      aiAssistantApiKeyEncrypted: true,
    },
  });
  if (!org || !org.aiAssistantEnabled) {
    return Response.json({ error: "Assistant is not enabled" }, { status: 403 });
  }

  const providerResult = providerSchema.safeParse(org.aiAssistantProvider);
  if (!providerResult.success) {
    return Response.json({ error: "Assistant backend is invalid" }, { status: 500 });
  }
  const provider: AssistantProvider = providerResult.data;
  let apiKey: string | undefined;
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

  const memoryEnabled = user.aiMemoryEnabled;
  const musicEnabled =
    org.accountType === "PERSONAL" && user.focusPacks.includes("music");
  const memories = memoryEnabled
    ? await listMemories(user.orgId, user.id)
    : [];
  const assistantTools =
    org.accountType === "AUTO_SHOP"
      ? tools.filter((tool) => tool.name !== "add_income")
      : tools;
  const availableTools = [
    ...assistantTools,
    ...(memoryEnabled ? memoryTools : []),
    ...(musicEnabled ? musicTools : []),
  ];
  const systemPrompt = buildAssistantSystemPrompt({
    assistantName: org.aiAssistantName,
    timezone,
    now,
    accountType: org.accountType,
    memories,
    musicEnabled,
  });
  const model = provider === "OPENAI" ? OPENAI_MODEL : ANTHROPIC_MODEL;

  const callProvider: ProviderCaller = (conversationMessages) =>
    runAssistantProvider({
      provider,
      apiKey,
      model,
      systemPrompt,
      messages: conversationMessages,
      tools: availableTools,
    });

  try {
    const { reply, steps } = await runAssistantConversation({
      callProvider,
      executeTool: (name, args) =>
        executeTool(
          user.orgId as string,
          ctx,
          name as AssistantToolName,
          args,
          user.role !== "STAFF",
          org.accountType,
          user.id,
          memoryEnabled,
          musicEnabled,
        ),
      messages,
      maxIterations: MAX_TOOL_ITERATIONS,
    });
    return Response.json({ reply, steps });
  } catch (error) {
    console.error("[assistant] provider error", error);
    return Response.json({ reply: friendlyError(error), steps: [] });
  }
}
