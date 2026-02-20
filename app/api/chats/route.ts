import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const isGlobal = projectId === null || projectId === "";
  const where = (isGlobal ? { projectId: null } : { projectId: projectId! }) as Prisma.ChatWhereInput;
  const chats = await prisma.chat.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { messages: true } },
    },
  });
  return Response.json(chats);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { projectId, title } = body as { projectId?: string | null; title?: string };
  const chat = await prisma.chat.create({
    data: {
      title: title ?? null,
      ...(projectId?.trim() && { projectId }),
    } as Parameters<typeof prisma.chat.create>[0]["data"],
  });
  return Response.json(chat);
}
