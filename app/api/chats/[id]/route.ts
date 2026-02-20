import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chat = await prisma.chat.findUnique({
    where: { id },
    include: {
      project: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!chat)
    return Response.json({ error: "Chat not found" }, { status: 404 });
  return Response.json(chat);
}
