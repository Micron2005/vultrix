import type { AssistantMessage, ProviderResponse } from "./providers";

/**
 * Executes a single tool call and returns a short confirmation plus structured
 * data that gets fed back to the model.
 */
export type ToolExecutor = (
  name: string,
  args: unknown,
) => Promise<{ confirmation: string; result: unknown }>;

/** Calls the underlying LLM provider with the running message list. */
export type ProviderCaller = (
  messages: AssistantMessage[],
) => Promise<ProviderResponse>;

export type ConversationStep = { tool: string; confirmation: string };

export type ConversationResult = {
  reply: string;
  steps: ConversationStep[];
};

/**
 * Drives a real multi-turn tool-use conversation.
 *
 * Unlike the previous single-shot flow (which returned raw tool output after the
 * first pass and dead-ended on any error), this keeps looping: after each tool
 * runs, its result — success OR error — is appended to the message list and sent
 * back to the model. That lets the assistant recover from a bad argument, ask a
 * natural follow-up question (e.g. "what should I title the note?"), chain
 * multiple actions, and always finish with a conversational reply in its own
 * words. When the model responds with no tool calls, that message is the reply.
 */
export async function runAssistantConversation(options: {
  callProvider: ProviderCaller;
  executeTool: ToolExecutor;
  messages: AssistantMessage[];
  maxIterations?: number;
}): Promise<ConversationResult> {
  const { callProvider, executeTool } = options;
  const maxIterations = options.maxIterations ?? 6;
  const messages: AssistantMessage[] = [...options.messages];
  const steps: ConversationStep[] = [];

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const response = await callProvider(messages);

    messages.push({
      role: "assistant",
      content: response.content,
      toolCalls: response.toolCalls,
    });

    if (response.toolCalls.length === 0) {
      const reply = response.content.trim() || summarize(steps);
      return { reply, steps };
    }

    for (const call of response.toolCalls) {
      const outcome = await executeTool(call.name, call.arguments);
      steps.push({ tool: call.name, confirmation: outcome.confirmation });
      messages.push({
        role: "tool",
        toolCallId: call.id,
        content: JSON.stringify({
          data: outcome.result,
          confirmation: outcome.confirmation,
        }),
      });
    }
    // Loop: the model now sees the tool results and can reply or continue.
  }

  return {
    reply: steps.length
      ? summarize(steps)
      : "I couldn't finish that. Please try rephrasing your request.",
    steps,
  };
}

function summarize(steps: ConversationStep[]): string {
  if (steps.length === 0) return "I’m ready.";
  return steps.map((step) => step.confirmation).join(" ");
}
