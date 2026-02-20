import { openai } from "@ai-sdk/openai";
import type { Message } from "ai";
import { convertToCoreMessages, streamText } from "ai";
import { INTERVIEWER_SYSTEM_PROMPT } from "@/lib/prompts";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: Omit<Message, "id">[] };

  const result = streamText({
    model: openai("gpt-4o"),
    system: INTERVIEWER_SYSTEM_PROMPT,
    messages: convertToCoreMessages(messages),
  });

  return result.toDataStreamResponse();
}
