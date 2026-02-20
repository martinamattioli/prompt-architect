import type { FrontDoorContext } from "./front-door";
import type { GlobalContext } from "./global-context";

export type ProjectContext = {
  name: string;
  company: string;
  techStack: string | null;
  brandVoice: string | null;
  archDecisions: string | null;
};

export function buildGlobalBlock(global: GlobalContext | null): string {
  if (!global) return "";
  return `
GLOBAL KNOWLEDGE (ZERF — always apply; use for brand voice and audience when no project is selected):
- Brand voice: ${global.brandVoice}
- Target audience: ${global.targetAudience}
${global.industryFocus ? `- Industry focus: ${global.industryFocus}` : ""}
${global.tone ? `- Tone: ${global.tone}` : ""}
`;
}

function buildProjectBlock(project: ProjectContext): string {
  return `
PROJECT CONTEXT (ground the conversation in this; remember tech stack, brand voice, and prior decisions):
- Project: ${project.name}
- Company: ${project.company}
${project.techStack ? `- Tech stack: ${project.techStack}` : ""}
${project.brandVoice ? `- Brand voice: ${project.brandVoice}` : ""}
${project.archDecisions ? `- Architectural decisions:\n${project.archDecisions}` : ""}
`;
}

const CORE_RULES = `
RULES:
1. You MUST ask 3–5 clarifying questions before you are allowed to say you have "enough context" or to generate assets.
2. Structure your questions and final summary around CLEAR: Context (what we're building and why), Length/scope (how big, how many), Examples (references, similar things), Audience (who uses it), Role (who owns it / tone).
3. Do NOT generate the final deliverable until the user has answered your questions and you have explicitly confirmed "Requirements locked. Generating assets."
4. Push back on vague inputs. Extract missing context that non-technical or busy team members often omit.
5. If the user uploads a screenshot or image, analyze it (layout, colors, spacing, typography) and weave that into your questions or final summary.
6. Be concise. One or two questions per message is fine. No long essays.
7. After you have asked at least 3–5 questions and the user has answered, summarize the requirements in 2–3 sentences, then say exactly: "Requirements locked. Generating assets."
8. Do not output JSON or the final artifact yourself. Your only job is to interview and then signal that the tool will generate the structured output.`;

const MOBILE_CONTEXT = `
TARGET MOBILE: When the user is building for mobile (or Web + Mobile), apply mobile best practices in your questions and summary: React Native / native patterns where relevant, safe area insets, touch targets at least 44pt, error boundaries, and platform-specific considerations (iOS vs Android).`;

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
 * Build the interviewer system prompt from Global + optional Project + Front Door context.
 * Global context (ZERF brand voice and audience) is always applied when provided.
 */
export function buildInterviewerSystemPrompt(
  ctx: FrontDoorContext | null,
  project: ProjectContext | null = null,
  global: GlobalContext | null = null
): string {
  const areaGuidance = ctx ? AREA_GUIDANCE[ctx.area] : AREA_GUIDANCE.software;
  const globalBlock = buildGlobalBlock(global);
  const projectBlock = project ? buildProjectBlock(project) : "";
  const contextBlock = ctx
    ? `
USER CONTEXT (from the Front Door — use this; do not ask again for these):
- Area/Role: ${ctx.area}
- Goal: ${ctx.goal}
- Company context: ${ctx.company}
${ctx.techStack?.trim() ? `- Tech stack: ${ctx.techStack.trim()}` : ""}
${ctx.targetPlatform?.trim() ? `- Target platform: ${ctx.targetPlatform}` : ""}
${ctx.keyConstraints?.trim() ? `- Key constraints: ${ctx.keyConstraints.trim()}` : ""}
${ctx.supportingText ? `- Supporting material:\n${ctx.supportingText}` : ""}
${ctx.figmaLink ? `- Figma link: ${ctx.figmaLink}` : ""}
${(ctx.techStack?.trim() || ctx.targetPlatform?.trim() || ctx.keyConstraints?.trim()) ? `\nThe user already provided the above. Do NOT ask again for tech stack, target, or constraints. Only ask about what is still missing (e.g. edge cases, state, accessibility, acceptance criteria).` : ""}
${ctx.targetPlatform === "mobile" || ctx.targetPlatform === "both" ? MOBILE_CONTEXT : ""}

Adapt your questions to this area. ${areaGuidance}
`
    : "";

  return `You are a Senior Architect for ZERF Company. Your role is Reverse Prompting: you interview the user to eliminate ambiguity before any deliverable is produced. You support every role—partners selling to leads, juniors building UI, leads creating tickets, leadership writing LinkedIn or reports.
${globalBlock}
${projectBlock}
${contextBlock}
${CORE_RULES}`;
}

/**
 * Build the request to synthesize a single, assertive "golden prompt" from refined requirements and context.
 * The model should output one copy-paste-ready prompt (no JSON, no preamble) that encodes CLEAR + all context.
 */
export function buildSynthesizedPromptRequest(
  requirementsSummary: string,
  area: string,
  imageContext?: string | null,
  project?: ProjectContext | null,
  global?: GlobalContext | null,
  frontDoor?: { goal: string; techStack?: string; targetPlatform?: string; company: string } | null
): string {
  const globalBlock = buildGlobalBlock(global ?? null);
  const projectBlock = project ? buildProjectBlock(project) : "";
  const ctxBlock = frontDoor
    ? `\nFront door: Goal="${frontDoor.goal}", Company=${frontDoor.company}${frontDoor.techStack ? `, Tech stack=${frontDoor.techStack}` : ""}${frontDoor.targetPlatform ? `, Target=${frontDoor.targetPlatform}` : ""}\n`
    : "";
  let prompt = `You are a senior prompt engineer. Your only job is to output a single, assertive, copy-paste-ready prompt that would instruct an AI to produce the deliverable. No JSON, no "Here is the prompt:", no preamble—just the prompt text itself.

The prompt must encode:
- CLEAR: context (what and why), length/scope, examples if relevant, audience, role/tone.
- The refined requirements below.
- Any project/company constraints (tech stack, brand voice, conventions) so the output follows them.
${globalBlock}
${projectBlock}
${ctxBlock}

REFINED REQUIREMENTS:
${requirementsSummary}
`;
  if (imageContext) {
    prompt += `

DESIGN CONTEXT (from screenshot/Figma—weave into the prompt so the AI knows layout, colors, typography):
${imageContext}
`;
  }
  prompt += `

Output a single, direct prompt (2–8 sentences or equivalent) that an engineer or partner could paste into ChatGPT/Claude to get the right deliverable. Be specific and assertive.`;
  return prompt;
}

/**
 * Prompt for generateObject: turn refined requirements into ZERF-standard ticket (Software).
 * Global context is always applied when provided; project context is optional.
 */
export function buildAssetGenerationPrompt(
  requirementsSummary: string,
  imageContext?: string,
  project?: ProjectContext | null,
  global?: GlobalContext | null
): string {
  const globalBlock = buildGlobalBlock(global ?? null);
  const projectBlock = project
    ? `\nPROJECT CONTEXT (align ticket with this):\n- ${project.name} (${project.company})\n${project.techStack ? `- Tech stack: ${project.techStack}\n` : ""}${project.archDecisions ? `- Prior decisions: ${project.archDecisions}\n` : ""}\n`
    : "";
  let prompt = `Convert the following refined requirements into a single ZERF-standard engineering ticket. Output only valid JSON matching the schema.
${globalBlock}
${projectBlock}
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
 * Global context (ZERF brand + audience) is always applied when provided.
 */
export function buildGenericArtifactPrompt(
  area: string,
  requirementsSummary: string,
  imageContext?: string,
  project?: ProjectContext | null,
  global?: GlobalContext | null
): string {
  const globalBlock = buildGlobalBlock(global ?? null);
  const projectBlock = project && project.brandVoice
    ? `\nPROJECT BRAND VOICE: ${project.brandVoice}\n\n`
    : "";
  const typeByArea: Record<string, string> = {
    management: "LinkedIn post, status report, or HR/leadership artifact",
    sales: "LinkedIn post, sales email, discovery script, or SOW section",
    design: "design spec, handoff notes, or component documentation",
  };
  const artifactExamples = typeByArea[area] ?? "structured deliverable";
  let prompt = `Convert the following refined requirements into a single deliverable. CRITICAL: Produce the exact type the user asked for.
- If they asked for a LinkedIn post → output a LinkedIn post (concise, engaging, suitable for LinkedIn; no email greeting/sign-off).
- If they asked for an email → output an email (with appropriate greeting and sign-off).
- If they asked for a script, report, or other format → output that format.
Allowed types for this area: ${artifactExamples}. Infer the type from the refined requirements and user goal; do not default to email when they asked for a post.
Output only valid JSON with "title" and "body" (full content).
${globalBlock}
${projectBlock}
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
- body: complete, ready-to-use content in the format the user requested (e.g. LinkedIn post text only, or email with greeting/sign-off).`;
  return prompt;
}

/**
 * Prompt for generateObject: produce the actual React/UI component code (Software).
 * Global context is applied when provided; project tech stack and arch decisions are optional.
 */
export function buildComponentGenerationPrompt(
  requirementsSummary: string,
  imageContext?: string,
  project?: ProjectContext | null,
  global?: GlobalContext | null
): string {
  const globalBlock = buildGlobalBlock(global ?? null);
  const projectBlock = project
    ? `\nPROJECT CONTEXT (use this stack and conventions):\n- ${project.name}\n${project.techStack ? `- Tech stack: ${project.techStack}\n` : ""}${project.archDecisions ? `- Conventions: ${project.archDecisions}\n` : ""}\n`
    : "";
  let prompt = `Generate a single, production-ready UI component from the refined requirements. Output only valid JSON with "name", "filename", "code", and "language".
${globalBlock}
${projectBlock}
REFINED REQUIREMENTS:
${requirementsSummary}
`;
  if (imageContext) {
    prompt += `

EXTRACTED FROM UPLOADED DESIGN (screenshot/Figma):
${imageContext}
Reflect these layout, colors, spacing, and typography in the component (Tailwind classes or CSS as appropriate).`;
  }
  prompt += `

Requirements:
- name: PascalCase component name (e.g. Stepper).
- filename: e.g. Stepper.tsx (use .tsx for React with TypeScript).
- code: full source code only, no markdown fences or explanation. Use the project tech stack (React, Next, Tailwind, etc.). Export the component. Include types if TypeScript.
- language: "tsx" or "ts" or "jsx" or "js".`;
  return prompt;
}
