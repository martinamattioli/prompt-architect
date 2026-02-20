# Prompt Architect | ZERF

Project-aware meta-prompting workbench: **Project Context** (tech stack, brand voice, prior decisions) + **Reverse Prompting** (AI interviews the user) and **Multi-Output Chaining** (tickets, QA plans, client questions from one refined source).

## Features

- **Project context & persistence** — Select a project (e.g. Sandals Online Check-in); the AI is grounded in its tech stack, brand voice, and architectural decisions. Chats and messages are stored (Projects, Chats, Messages tables).
- **Interviewer (Reverse Prompting)** — The AI asks 3–5 clarifying questions before generating assets. Uses `useChat` (Vercel AI SDK) with a system prompt that blocks generation until “Requirements locked.”
- **Structured assets** — After discovery, `generateObject` + Zod produces a ZERF-standard ticket: title, user story, technical requirements, Gherkin acceptance criteria, 3 client questions, and QA test cases.
- **Multimodal** — Upload a Figma/UI screenshot; the model uses vision (GPT-4o) to extract layout, colors, and spacing and inject them into technical requirements.

## Setup

1. **Install**

   ```bash
   npm install
   ```

2. **Environment** — In `.env` set `DATABASE_URL="file:./prisma/dev.db"` (for Prisma). In `.env.local` set `OPENAI_API_KEY=sk-...`.

3. **Database** — Run `npx prisma db push` then `npm run db:seed` to create tables and seed projects (Sandals Online Check-in, PRIOR, Micro-product).

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

- Push to GitHub and import the repo in [Vercel](https://vercel.com).
- Add `OPENAI_API_KEY` in Project → Settings → Environment Variables.
- Deploy.

## Stack

- **Next.js 15** (App Router)
- **Prisma** + **SQLite** (Projects, Chats, Messages)
- **Vercel AI SDK** (`ai`, `@ai-sdk/react`, `@ai-sdk/openai`)
- **Zod** for structured output schema
- **Tailwind CSS** for UI

## Flow

1. **Front Door**: Choose Area (Software / Management / Sales / Design), Goal, Company; optionally supporting text and Figma link. User describes a goal (e.g. “Build a stepper”).
2. **Start interview**: Context is sent with every chat request; the interviewer adapts by area.
3. User can attach a screenshot; the model uses it in the conversation.
4. When the AI says “Requirements locked. Generating assets,” the **Generate assets** button appears.
5. **Software** → full ticket (Jira/Linear style). **Other areas** → title + body (LinkedIn, email, report, spec).
6. Copy the result (Markdown or plain text).
