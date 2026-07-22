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
  type AddCalendarEventArgs,
  type AddExpenseArgs,
  type AddIncomeArgs,
  type AddNoteArgs,
  type AdjustInventoryArgs,
  type CreateInventoryPartArgs,
  type PeriodArgs,
  type ReportsSummaryArgs,
  type UpcomingEventsArgs,
} from "@/lib/assistant";
import {
  runAssistantProvider,
  type AssistantMessage,
  type AssistantProvider,
  type AssistantToolDefinition,
  type AssistantToolName,
} from "@/lib/assistant/providers";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
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

const tools: AssistantToolDefinition[] = [
  {
    name: "create_inventory_part",
    description: "Create an inventory part, optionally with opening stock.",
    parameters: {
      type: "object",
      properties: {
        name: property("string", "Part name"),
        partNumber: property("string"),
        category: property("string"),
        unit: property("string"),
        openingQuantity: property("number", "Opening quantity, default 0"),
        reorderLevel: property("number", "Low-stock threshold, default 0"),
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "adjust_inventory",
    description: "Add or remove inventory by part name or ID.",
    parameters: {
      type: "object",
      properties: {
        partId: property("string"),
        partName: property("string"),
        delta: property("number", "Positive to add, negative to remove"),
        reason: property("string", "RECEIVE or ADJUST"),
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
        receivedAt: property("string", "ISO date/time, optional"),
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
        paidAt: property("string", "ISO date/time, optional"),
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
    description: "Add a Knowledge note with a title, details, and tags.",
    parameters: {
      type: "object",
      properties: {
        title: property("string"),
        details: property("string"),
        tags: property("string", "Comma-separated tags"),
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
        startsAt: property("string", "ISO date/time"),
        endsAt: property("string", "ISO date/time, optional"),
        allDay: property("boolean"),
        isReminder: property("boolean"),
        notes: property("string"),
      },
      required: ["title", "startsAt"],
      additionalProperties: false,
    },
  },
  {
    name: "get_financial_summary",
    description: "Read money in, money out, and net for a period.",
    parameters: {
      type: "object",
      properties: {
        from: property("string", "ISO date/time, optional"),
        to: property("string", "ISO date/time, optional"),
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
        from: property("string", "ISO date/time, optional"),
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
        from: property("string", "ISO date/time, optional"),
        to: property("string", "ISO date/time, optional"),
      },
      additionalProperties: false,
    },
  },
];

const providerSchema = z.enum(["OLLAMA", "OPENAI", "ANTHROPIC"]);
const MAX_TOOL_ITERATIONS = 5;

function friendlyError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return "I couldn't use those details. Please provide the required information.";
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
        return finish(await addAssistantIncome(orgId, args as AddIncomeArgs));
      case "add_expense":
        return finish(await addAssistantExpense(orgId, args as AddExpenseArgs));
      case "add_note":
        return finish(await addAssistantNote(orgId, args as AddNoteArgs));
      case "add_calendar_event":
        return finish(await addAssistantCalendarEvent(
          orgId,
          args as AddCalendarEventArgs,
        ));
      case "get_financial_summary":
        return finish(await getAssistantFinancialSummary(orgId, args as PeriodArgs));
      case "get_inventory_overview":
        return finish(await getAssistantInventoryOverview(orgId));
      case "get_upcoming_events":
        return finish(await getAssistantUpcomingEvents(
          orgId,
          args as UpcomingEventsArgs,
        ));
      case "get_reports_summary":
        return finish(await getAssistantReportsSummary(
          orgId,
          args as ReportsSummaryArgs,
        ));
    }
  } catch (error) {
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

  const messages: AssistantMessage[] = [
    ...parsed.data.history,
    { role: "user", content: parsed.data.message },
  ];
  const steps: Array<{ tool: string; confirmation: string }> = [];
  const systemPrompt = [
    `You are ${org.aiAssistantName}, a helpful personal assistant.`,
    "Use the available tools to read or change the user's data instead of pretending.",
    "Ask a brief clarification when required information is missing.",
    "After a tool completes, confirm the result briefly and naturally.",
    "Never claim an action succeeded if its tool returned an error.",
  ].join(" ");

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    let providerResponse;
    try {
      providerResponse = await runAssistantProvider({
        provider,
        apiKey,
        model:
          provider === "OLLAMA"
            ? process.env.OLLAMA_MODEL ?? "llama3.1:8b"
            : provider === "OPENAI"
              ? "gpt-4o-mini"
              : "claude-3-5-haiku-latest",
        systemPrompt,
        messages,
        tools,
      });
    } catch (error) {
      return Response.json({
        reply: friendlyError(error),
        steps,
      });
    }

    messages.push({
      role: "assistant",
      content: providerResponse.content,
      toolCalls: providerResponse.toolCalls,
    });
    if (providerResponse.toolCalls.length === 0) {
      return Response.json({ reply: providerResponse.content || "I’m ready.", steps });
    }

    for (const call of providerResponse.toolCalls) {
      const result = await executeTool(user.orgId, call.name, call.arguments);
      steps.push({ tool: call.name, confirmation: result.confirmation });
      messages.push({
        role: "tool",
        toolCallId: call.id,
        content: JSON.stringify({
          data: result.result,
          confirmation: result.confirmation,
        }),
      });
    }
  }

  return Response.json({
    reply: "I reached the action limit before finishing. Please try a simpler request.",
    steps,
  });
}
