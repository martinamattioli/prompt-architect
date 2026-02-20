import { openai } from "@ai-sdk/openai";
import type { Message } from "ai";
import { convertToCoreMessages, generateObject, generateText } from "ai";
import { ticketSchema } from "@/lib/schemas";
import { buildAssetGenerationPrompt } from "@/lib/prompts";

export const maxDuration = 60;

type RequestBody = {
  requirementsSummary?: string;
  imageContext?: string;
  messages?: Omit<Message, "id">[];
};

export async function POST(req: Request) {
  const body: RequestBody = await req.json();
  let requirementsSummary = body.requirementsSummary?.trim();
  const imageContext = body.imageContext?.trim();
  const messages = body.messages;

  if (!requirementsSummary && messages?.length) {
    const modelMessages = convertToCoreMessages(messages);
    const { text } = await generateText({
      model: openai("gpt-4o"),
      messages: modelMessages,
      system: `You are a technical writer. Summarize the conversation into a short "refined requirements" paragraph (2-4 sentences) that will be used to generate a ZERF-standard engineering ticket. Include: goal, tech context, edge cases, and any design/layout notes from screenshots. Output only the summary, no preamble.`,
    });
    requirementsSummary = text?.trim() ?? "";
  }

  if (!requirementsSummary) {
    return Response.json(
      { error: "Provide requirementsSummary or messages to derive it" },
      { status: 400 }
    );
  }

  const prompt = buildAssetGenerationPrompt(requirementsSummary, imageContext);

  const { object } = await generateObject({
    model: openai("gpt-4o"),
    schema: ticketSchema,
    prompt,
  });

  return Response.json({ ticket: object });
}
