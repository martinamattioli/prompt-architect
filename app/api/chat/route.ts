import { openai } from "@ai-sdk/openai";
import type { Message } from "ai";
import { convertToCoreMessages, streamText } from "ai";
import { buildInterviewerSystemPrompt } from "@/lib/prompts";
import type { FrontDoorContext } from "@/lib/front-door";
import { getGlobalContext } from "@/lib/global-context";
import { prisma } from "@/lib/db";

export const maxDuration = 60;

type ChatBody = {
  messages: Omit<Message, "id">[];
  context?: FrontDoorContext | null;
  projectId?: string | null;
};

export async function POST(req: Request) {
  const { messages, context, projectId } = (await req.json()) as ChatBody;

  const globalContext = await getGlobalContext();

  let projectContext: { name: string; company: string; techStack: string | null; brandVoice: string | null; archDecisions: string | null } | null = null;
  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (project) {
      projectContext = {
        name: project.name,
        company: project.company,
        techStack: project.techStack,
        brandVoice: project.brandVoice,
        archDecisions: project.archDecisions,
      };
    }
  }

  const systemPrompt = buildInterviewerSystemPrompt(context ?? null, projectContext, globalContext);

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages: convertToCoreMessages(messages),
  });

  return result.toDataStreamResponse();
}
