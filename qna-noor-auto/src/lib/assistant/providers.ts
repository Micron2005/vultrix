export type AssistantProvider = "OLLAMA" | "OPENAI" | "ANTHROPIC";

export type AssistantToolName =
  | "create_inventory_part"
  | "adjust_inventory"
  | "add_income"
  | "add_expense"
  | "add_note"
  | "update_note"
  | "add_calendar_event"
  | "read_note"
  | "remove_calendar_event"
  | "get_financial_summary"
  | "get_inventory_overview"
  | "get_upcoming_events"
  | "get_reports_summary";

export type JsonSchema = {
  type: "object";
  properties: Record<string, JsonSchema | { type: string; [key: string]: unknown }>;
  required?: string[];
  additionalProperties?: boolean;
};

export type AssistantToolDefinition = {
  name: AssistantToolName;
  description: string;
  parameters: JsonSchema;
};

export type AssistantMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: AssistantToolCall[];
};

export type AssistantToolCall = {
  id: string;
  name: AssistantToolName;
  arguments: unknown;
};

export type ProviderResponse = {
  content: string;
  toolCalls: AssistantToolCall[];
};

type ProviderRequest = {
  provider: AssistantProvider;
  apiKey?: string;
  model: string;
  systemPrompt: string;
  messages: AssistantMessage[];
  tools: AssistantToolDefinition[];
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseArguments(value: unknown): unknown {
  if (typeof value !== "string") return value ?? {};
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

function toolDefinitions(tools: AssistantToolDefinition[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

async function readProviderResponse(response: Response): Promise<UnknownRecord> {
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.error === "string"
        ? body.error
        : `Provider returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  if (!isRecord(body)) throw new Error("Provider returned an invalid response.");
  return body;
}

async function callOpenAi(request: ProviderRequest): Promise<ProviderResponse> {
  const messages = [
    { role: "system", content: request.systemPrompt },
    ...request.messages.map((message) => {
      if (message.role === "assistant") {
        return {
          role: "assistant",
          content: message.content || null,
          tool_calls: (message.toolCalls ?? []).map((call) => ({
            id: call.id,
            type: "function",
            function: {
              name: call.name,
              arguments: JSON.stringify(call.arguments),
            },
          })),
        };
      }
      if (message.role === "tool") {
        return {
          role: "tool",
          tool_call_id: message.toolCallId ?? "",
          content: message.content,
        };
      }
      return { role: "user", content: message.content };
    }),
  ];
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.apiKey ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
      messages,
      tools: toolDefinitions(request.tools),
      tool_choice: "auto",
    }),
  });
  const body = await readProviderResponse(response);
  const choices = Array.isArray(body.choices) ? body.choices : [];
  const message = choices[0] && isRecord(choices[0]) ? choices[0].message : null;
  if (!isRecord(message)) throw new Error("OpenAI returned no assistant message.");
  const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  return {
    content: stringValue(message.content),
    toolCalls: calls.flatMap((call, index) => {
      if (!isRecord(call) || !isRecord(call.function)) return [];
      const name = stringValue(call.function.name) as AssistantToolName;
      if (!name) return [];
      return [
        {
          id: stringValue(call.id) || `openai-${index}`,
          name,
          arguments: parseArguments(call.function.arguments),
        },
      ];
    }),
  };
}

async function callAnthropic(request: ProviderRequest): Promise<ProviderResponse> {
  const messages: Array<{ role: "user" | "assistant"; content: string | Array<UnknownRecord> }> = [];
  for (const message of request.messages) {
    if (message.role === "assistant") {
      const content: Array<UnknownRecord> = [];
      if (message.content) content.push({ type: "text", text: message.content });
      for (const call of message.toolCalls ?? []) {
        content.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: call.arguments,
        });
      }
      messages.push({ role: "assistant", content });
      continue;
    }
    if (message.role === "tool") {
      const previous = messages[messages.length - 1];
      const result = {
        type: "tool_result",
        tool_use_id: message.toolCallId ?? "",
        content: message.content,
      };
      if (previous?.role === "user" && Array.isArray(previous.content)) {
        previous.content.push(result);
      } else {
        messages.push({ role: "user", content: [result] });
      }
      continue;
    }
    messages.push({ role: "user", content: message.content });
  }
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": request.apiKey ?? "",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
      max_tokens: 1536,
      system: request.systemPrompt,
      messages,
      tools: request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      })),
    }),
  });
  const body = await readProviderResponse(response);
  const content = Array.isArray(body.content) ? body.content : [];
  return {
    content: content
      .filter((block): block is UnknownRecord => isRecord(block))
      .filter((block) => block.type === "text")
      .map((block) => stringValue(block.text))
      .join(""),
    toolCalls: content.flatMap((block, index) => {
      if (!isRecord(block) || block.type !== "tool_use") return [];
      const name = stringValue(block.name) as AssistantToolName;
      if (!name) return [];
      return [
        {
          id: stringValue(block.id) || `anthropic-${index}`,
          name,
          arguments: block.input ?? {},
        },
      ];
    }),
  };
}

async function callOllama(request: ProviderRequest): Promise<ProviderResponse> {
  const baseUrl = (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(
    /\/$/,
    "",
  );
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.OLLAMA_API_KEY
        ? { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      model: request.model,
      stream: false,
      messages: [
        { role: "system", content: request.systemPrompt },
        ...request.messages.map((message) => ({
          role: message.role,
          content: message.content,
          ...(message.toolCalls
            ? {
                tool_calls: message.toolCalls.map((call) => ({
                  function: {
                    name: call.name,
                    arguments: call.arguments,
                  },
                })),
              }
            : {}),
        })),
      ],
      tools: toolDefinitions(request.tools),
    }),
  });
  const body = await readProviderResponse(response);
  const message = isRecord(body.message) ? body.message : null;
  if (!message) throw new Error("Ollama returned no assistant message.");
  const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  return {
    content: stringValue(message.content),
    toolCalls: calls.flatMap((call, index) => {
      if (!isRecord(call) || !isRecord(call.function)) return [];
      const name = stringValue(call.function.name) as AssistantToolName;
      if (!name) return [];
      return [
        {
          id: `ollama-${index}`,
          name,
          arguments: call.function.arguments ?? {},
        },
      ];
    }),
  };
}

export async function runAssistantProvider(
  request: ProviderRequest,
): Promise<ProviderResponse> {
  if (request.provider === "OPENAI") return callOpenAi(request);
  if (request.provider === "ANTHROPIC") return callAnthropic(request);
  return callOllama(request);
}
