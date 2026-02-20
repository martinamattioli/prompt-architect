/**
 * Dynamic Input Schema — the "Front Door" for the Prompt Architect.
 * Routes intent by Area and Company so the interviewer and asset generator stay context-aware.
 */

export const AREAS = [
  { id: "software", label: "Software", role: "Engineering / Product" },
  { id: "management", label: "Management", role: "Leadership / Ops" },
  { id: "sales", label: "Sales", role: "Partners / Biz Dev" },
  { id: "design", label: "Design", role: "Design / UX" },
] as const;

export const COMPANIES = [
  "Sandals",
  "PRIOR",
  "Micro-product",
  "Other",
] as const;

export type AreaId = (typeof AREAS)[number]["id"];
export type Company = (typeof COMPANIES)[number];

/** Target platform options (Software/Design) */
export const TARGET_PLATFORMS = [
  { id: "", label: "Not specified" },
  { id: "web", label: "Web" },
  { id: "mobile", label: "Mobile" },
  { id: "both", label: "Web + Mobile" },
] as const;

/** Common tech stack presets — click to add, minimal typing */
export const TECH_STACK_PRESETS = [
  "React",
  "Next.js",
  "Vue",
  "TypeScript",
  "Tailwind",
  "Node",
  "React Native",
  "Expo",
] as const;

/** Goal input placeholder examples per area (for UX only) */
export const GOAL_PLACEHOLDERS: Record<AreaId, string> = {
  software:
    "e.g. Build a stepper, Write a bug ticket, Add auth to the dashboard",
  management:
    "e.g. Draft a LinkedIn post, Write an HR objective, Create a status report",
  sales:
    "e.g. Draft a lead email, Prepare a discovery call script, SOW for a prospect",
  design:
    "e.g. Spec a component from Figma, Document design tokens, Handoff notes",
};

export interface FrontDoorContext {
  area: AreaId;
  goal: string;
  company: string;
  /** Comma-separated or from presets */
  techStack?: string;
  targetPlatform?: string;
  keyConstraints?: string;
  supportingText?: string;
  figmaLink?: string;
}
