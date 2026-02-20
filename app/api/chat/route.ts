import { openai } from "@ai-sdk/openai";
import type { Message } from "ai";
import { convertToCoreMessages, streamText } from "ai";
import { buildInterviewerSystemPrompt } from "@/lib/prompts";
import type { FrontDoorContext } from "@/lib/front-door";

export const maxDuration = 60;

type ChatBody = {
  messages: Omit<Message, "id">[];
  context?: FrontDoorContext | null;
};

export async function POST(req: Request) {
  const { messages, context } = (await req.json()) as ChatBody;

  const systemPrompt = buildInterviewerSystemPrompt(context ?? null);

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages: convertToCoreMessages(messages),
  });

  return result.toDataStreamResponse();
}
