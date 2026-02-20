import { prisma } from "@/lib/db";

export type GlobalContext = {
  name: string;
  brandVoice: string;
  targetAudience: string;
  industryFocus: string | null;
  tone: string | null;
};

const ZERF_SLUG = "zerf";

export async function getGlobalContext(): Promise<GlobalContext | null> {
  const rows = await prisma.$queryRaw<
    { name: string; brandVoice: string; targetAudience: string; industryFocus: string | null; tone: string | null }[]
  >`SELECT name, brandVoice, targetAudience, industryFocus, tone FROM GlobalContext WHERE slug = ${ZERF_SLUG}`;
  const row = rows[0] ?? null;
  if (!row) return null;
  return { name: row.name, brandVoice: row.brandVoice, targetAudience: row.targetAudience, industryFocus: row.industryFocus, tone: row.tone };
}
