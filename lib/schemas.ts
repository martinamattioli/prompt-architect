import { z } from "zod";

/**
 * ZERF-standard ticket schema for generateObject.
 * Ensures deterministic, application-ready JSON for Jira/Linear.
 */
export const qaTestCaseSchema = z.object({
  scenario: z.string().describe("Test scenario description"),
  expectedResult: z.string().describe("Expected outcome in Given-When-Then style"),
});

export const ticketSchema = z.object({
  title: z.string().describe("Short, actionable ticket title"),
  userStory: z.string().describe("As a... I want... So that..."),
  technicalRequirements: z
    .array(z.string())
    .describe("Bullet list of technical requirements"),
  acceptanceCriteria: z
    .array(z.string())
    .describe("Gherkin format: Given-When-Then"),
  clientQuestions: z
    .array(z.string())
    .length(3)
    .describe("3 high-level questions for the CEO to ask the client"),
  qaTestCases: z
    .array(qaTestCaseSchema)
    .min(3)
    .describe("QA test cases ready for the QA team"),
});

export type Ticket = z.infer<typeof ticketSchema>;
export type QATestCase = z.infer<typeof qaTestCaseSchema>;
