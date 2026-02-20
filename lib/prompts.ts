import type { FrontDoorContext } from "./front-door";

const CORE_RULES = `
RULES:
1. You MUST ask 3–5 clarifying questions before you are allowed to say you have "enough context" or to generate assets.
2. Do NOT generate the final deliverable until the user has answered your questions and you have explicitly confirmed "Requirements locked. Generating assets."
3. Push back on vague inputs. Extract missing context that non-technical or busy team members often omit.
4. If the user uploads a screenshot or image, analyze it (layout, colors, spacing, typography) and weave that into your questions or final summary.
5. Be concise. One or two questions per message is fine. No long essays.
6. After you have asked at least 3–5 questions and the user has answered, summarize the requirements in 2–3 sentences, then say exactly: "Requirements locked. Generating assets."
7. Do not output JSON or the final artifact yourself. Your only job is to interview and then signal that the tool will generate the structured output.`;

const AREA_GUIDANCE: Record<
  FrontDoorContext["area"],
  string
> = {
  software: `Focus on: tech stack, state management, edge cases (e.g. "Does this need to persist across page refreshes?"), accessibility, and client constraints.`,
  management: `Focus on: audience, tone, key messages, constraints (length, internal vs external), and any data or quotes to include.`,
  sales: `Focus on: prospect context, stage of the deal, tone (formal/casual), must-include points, and any compliance or legal constraints.`,
  design: `Focus on: component scope, design system alignment, responsive behavior, accessibility, and handoff format.`,
};

/**
 * Build the interviewer system prompt from Front Door context.
 * Adapts tone and focus by Area so the AI extracts the right missing context.
 */
export function buildInterviewerSystemPrompt(ctx: FrontDoorContext | null): string {
  const areaGuidance = ctx ? AREA_GUIDANCE[ctx.area] : AREA_GUIDANCE.software;
  const contextBlock = ctx
    ? `
USER CONTEXT (from the Front Door):
- Area/Role: ${ctx.area}
- Goal: ${ctx.goal}
- Company context: ${ctx.company}
${ctx.supportingText ? `- Supporting material (user-provided text):\n${ctx.supportingText}` : ""}
${ctx.figmaLink ? `- Figma link: ${ctx.figmaLink}` : ""}

Adapt your questions to this area. ${areaGuidance}
`
    : "";

  return `You are a Senior Architect for ZERF Company. Your role is Reverse Prompting: you interview the user to eliminate ambiguity before any deliverable is produced. You support every role—partners selling to leads, juniors building UI, leads creating tickets, leadership writing LinkedIn or reports.
${contextBlock}
${CORE_RULES}`;
}

/**
 * Prompt for generateObject: turn refined requirements into ZERF-standard ticket (Software).
 */
export function buildAssetGenerationPrompt(
  requirementsSummary: string,
  imageContext?: string
): string {
  let prompt = `Convert the following refined requirements into a single ZERF-standard engineering ticket. Output only valid JSON matching the schema.

REFINED REQUIREMENTS:
${requirementsSummary}
`;
  if (imageContext) {
    prompt += `

EXTRACTED FROM UPLOADED DESIGN (screenshot/Figma):
${imageContext}
Use the above (colors, padding, layout, typography) to enrich technicalRequirements and acceptanceCriteria where relevant.`;
  }
  prompt += `

Requirements:
- userStory: "As a [role] I want [goal] so that [benefit]."
- acceptanceCriteria: use Gherkin (Given/When/Then).
- clientQuestions: exactly 3 high-level questions a CEO would ask the client.
- qaTestCases: at least 3 scenarios with expectedResult.`;
  return prompt;
}

/**
 * Prompt for non-Software areas: produce a single artifact (LinkedIn, email, report, spec).
 */
export function buildGenericArtifactPrompt(
  area: string,
  requirementsSummary: string,
  imageContext?: string
): string {
  const typeByArea: Record<string, string> = {
    management: "LinkedIn post, status report, or HR/leadership artifact",
    sales: "sales email, discovery script, or SOW section",
    design: "design spec, handoff notes, or component documentation",
  };
  const artifactType = typeByArea[area] ?? "structured deliverable";
  let prompt = `Convert the following refined requirements into a single ${artifactType}. Output only valid JSON with "title" and "body" (full content).

REFINED REQUIREMENTS:
${requirementsSummary}
`;
  if (imageContext) {
    prompt += `

EXTRACTED FROM UPLOADED DESIGN (screenshot/Figma):
${imageContext}
Use the above where relevant in the body.`;
  }
  prompt += `

Requirements:
- title: short, clear title for the artifact.
- body: complete, ready-to-use content (post, email, report, or spec).`;
  return prompt;
}
