import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.globalContext.upsert({
    where: { slug: "zerf" },
    update: {},
    create: {
      slug: "zerf",
      name: "ZERF",
      brandVoice:
        "Professional yet approachable. Clear, concise, and confident. We speak to decision-makers in hospitality with respect for their time and expertise. Avoid jargon; use concrete examples. Tone: partner, not vendor.",
      targetAudience:
        "Hospitality owners and operators, resort and hotel leadership, F&B and operations directors. Secondary: travel and hospitality tech buyers, general managers.",
      industryFocus: "Hospitality (resorts, hotels, F&B, operations, guest experience)",
      tone: "Partner-like, consultative, outcome-focused",
    },
  });

  await prisma.project.upsert({
    where: { slug: "sandals-online-checkin" },
    update: {},
    create: {
      name: "Sandals Online Check-in",
      slug: "sandals-online-checkin",
      company: "Sandals",
      techStack: "React, Next.js, TypeScript, Tailwind, Node",
      brandVoice:
        "Warm, clear, and reassuring. Avoid jargon. Guest-facing copy should feel personal and stress-free.",
      archDecisions:
        "- Use Next.js App Router; API routes for check-in flow.\n- State: React state + URL for wizard steps; no global store for check-in.\n- Auth: session-based; integrate with existing Sandals SSO where applicable.\n- Accessibility: WCAG 2.1 AA; all forms and steppers keyboard/screen-reader friendly.",
    },
  });
  await prisma.project.upsert({
    where: { slug: "prior" },
    update: {},
    create: {
      name: "PRIOR",
      slug: "prior",
      company: "PRIOR",
      techStack: "React, TypeScript",
      brandVoice: "Professional, concise.",
      archDecisions: "Align with existing PRIOR design system and API contracts.",
    },
  });
  await prisma.project.upsert({
    where: { slug: "micro-product" },
    update: {},
    create: {
      name: "Micro-product",
      slug: "micro-product",
      company: "Micro-product",
      techStack: "TBD",
      brandVoice: "TBD",
      archDecisions: "TBD",
    },
  });
  await prisma.project.upsert({
    where: { slug: "casa-bonita" },
    update: {},
    create: {
      name: "Casa Bonita",
      slug: "casa-bonita",
      company: "Casa Bonita",
      techStack: "TBD",
      brandVoice: "TBD",
      archDecisions: "TBD",
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
