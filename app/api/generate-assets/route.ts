import { openai } from "@ai-sdk/openai";
import type { Message } from "ai";
import { convertToCoreMessages, generateObject, generateText } from "ai";
import { artifactSchema, componentSchema, ticketSchema } from "@/lib/schemas";
import {
  buildAssetGenerationPrompt,
  buildComponentGenerationPrompt,
  buildGenericArtifactPrompt,
  buildSynthesizedPromptRequest,
} from "@/lib/prompts";
import type { AreaId } from "@/lib/front-door";
import type { FrontDoorContext } from "@/lib/front-door";
import { getGlobalContext } from "@/lib/global-context";
import { prisma } from "@/lib/db";

export const maxDuration = 90;

type SoftwareOutputType = "ticket" | "component" | "both";

type RequestBody = {
  requirementsSummary?: string;
  imageContext?: string;
  imageUrl?: string | null;
  area?: AreaId;
  messages?: Omit<Message, "id">[];
  chatId?: string | null;
  softwareOutput?: SoftwareOutputType;
  /** If true, return only the synthesized "golden prompt" text (no ticket/component/artifact). */
  outputPromptOnly?: boolean;
  /** Front-door context for synthesizing the prompt (goal, company, techStack, targetPlatform). */
  context?: FrontDoorContext | null;
};

export async function POST(req: Request) {
  const body: RequestBody = await req.json();
  let requirementsSummary = body.requirementsSummary?.trim();
  let imageContext = body.imageContext?.trim();
  const imageUrl = body.imageUrl?.trim();
  const area = body.area ?? "software";
  let messages = body.messages;
  const chatId = body.chatId;
  const softwareOutput = body.softwareOutput ?? "both";
  const outputPromptOnly = body.outputPromptOnly === true;
  const frontDoorContext = body.context ?? null;

  if (imageUrl && !imageContext) {
    const { text } = await generateText({
      model: openai("gpt-4o"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this UI screenshot in technical terms for a developer: layout (flex/grid, spacing), colors (hex or Tailwind-style), typography (sizes, weights), and key components. Output 2–4 concise sentences, no preamble.",
            },
            { type: "image", image: imageUrl, mimeType: "image/png" as const },
          ],
        },
      ],
    });
    imageContext = text?.trim() ?? "";
  }

  const globalContext = await getGlobalContext();

  let projectContext: { name: string; company: string; techStack: string | null; brandVoice: string | null; archDecisions: string | null } | null = null;

  if (chatId) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { project: true, messages: { orderBy: { createdAt: "asc" } } },
    });
    if (chat) {
      if (!messages?.length && chat.messages.length > 0) {
        messages = chat.messages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }));
      }
      if (chat.project) {
        projectContext = {
          name: chat.project.name,
          company: chat.project.company,
          techStack: chat.project.techStack,
          brandVoice: chat.project.brandVoice,
          archDecisions: chat.project.archDecisions,
        };
      }
    }
  }

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

  if (outputPromptOnly) {
    const promptRequest = buildSynthesizedPromptRequest(
      requirementsSummary,
      area,
      imageContext || null,
      projectContext,
      globalContext,
      frontDoorContext ? { goal: frontDoorContext.goal, techStack: frontDoorContext.techStack, targetPlatform: frontDoorContext.targetPlatform, company: frontDoorContext.company } : null
    );
    const { text } = await generateText({
      model: openai("gpt-4o"),
      messages: [{ role: "user", content: promptRequest }],
    });
    return Response.json({
      prompt: text?.trim() ?? "",
      requirementsSummary,
    });
  }

  const isSoftware = area === "software";

  if (isSoftware) {
    const out: { ticket?: unknown; component?: unknown; area: string; requirementsSummary: string } = { area: "software", requirementsSummary };
    if (softwareOutput === "ticket" || softwareOutput === "both") {
      const prompt = buildAssetGenerationPrompt(requirementsSummary, imageContext, projectContext, globalContext);
      const { object } = await generateObject({
        model: openai("gpt-4o"),
        schema: ticketSchema,
        prompt,
      });
      out.ticket = object;
    }
    if (softwareOutput === "component" || softwareOutput === "both") {
      const prompt = buildComponentGenerationPrompt(requirementsSummary, imageContext, projectContext, globalContext);
      const { object } = await generateObject({
        model: openai("gpt-4o"),
        schema: componentSchema,
        prompt,
      });
      out.component = object;
    }
    return Response.json(out);
  }

  const prompt = buildGenericArtifactPrompt(
    area,
    requirementsSummary,
    imageContext,
    projectContext,
    globalContext
  );
  const { object } = await generateObject({
    model: openai("gpt-4o"),
    schema: artifactSchema,
    prompt,
  });
  return Response.json({ artifact: object, area, requirementsSummary });
}
