import { openai } from "@ai-sdk/openai";
import type { Message } from "ai";
import { convertToCoreMessages, generateObject, generateText } from "ai";
import { artifactSchema, ticketSchema } from "@/lib/schemas";
import {
  buildAssetGenerationPrompt,
  buildGenericArtifactPrompt,
} from "@/lib/prompts";
import type { AreaId } from "@/lib/front-door";

export const maxDuration = 60;

type RequestBody = {
  requirementsSummary?: string;
  imageContext?: string;
  area?: AreaId;
  messages?: Omit<Message, "id">[];
};

export async function POST(req: Request) {
  const body: RequestBody = await req.json();
  let requirementsSummary = body.requirementsSummary?.trim();
  const imageContext = body.imageContext?.trim();
  const area = body.area ?? "software";
  const messages = body.messages;

  const summarizerSystem =
    area === "software"
      ? `You are a technical writer. Summarize the conversation into a short "refined requirements" paragraph (2-4 sentences) for a ZERF-standard engineering ticket. Include: goal, tech context, edge cases, and any design/layout notes from screenshots. Output only the summary, no preamble.`
      : `You are a writer. Summarize the conversation into a short "refined requirements" paragraph (2-4 sentences) that will be used to generate the final deliverable (post, email, report, or spec). Include: goal, audience, key points, and any constraints. Output only the summary, no preamble.`;

  if (!requirementsSummary && messages?.length) {
    const modelMessages = convertToCoreMessages(messages);
    const { text } = await generateText({
      model: openai("gpt-4o"),
      messages: modelMessages,
      system: summarizerSystem,
    });
    requirementsSummary = text?.trim() ?? "";
  }

  if (!requirementsSummary) {
    return Response.json(
      { error: "Provide requirementsSummary or messages to derive it" },
      { status: 400 }
    );
  }

  const isSoftware = area === "software";

  if (isSoftware) {
    const prompt = buildAssetGenerationPrompt(requirementsSummary, imageContext);
    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema: ticketSchema,
      prompt,
    });
    return Response.json({ ticket: object, area: "software" });
  }

  const prompt = buildGenericArtifactPrompt(
    area,
    requirementsSummary,
    imageContext
  );
  const { object } = await generateObject({
    model: openai("gpt-4o"),
    schema: artifactSchema,
    prompt,
  });
  return Response.json({ artifact: object, area });
}
