import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
  });
  if (!project)
    return Response.json({ error: "Project not found" }, { status: 404 });
  return Response.json(project);
}
