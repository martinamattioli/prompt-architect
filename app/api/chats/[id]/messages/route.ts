import { prisma } from "@/lib/db";

type MessageInput = { role: string; content: string; attachments?: unknown };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chatId } = await params;
  const body = await req.json();
  const { messages } = body as { messages: MessageInput[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages array required" }, { status: 400 });
  }
  const created = await prisma.$transaction(
    messages.map((m) =>
      prisma.message.create({
        data: {
          chatId,
          role: m.role,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          attachments: m.attachments ? JSON.stringify(m.attachments) : null,
        },
      })
    )
  );
  return Response.json(created);
}
