import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const where = projectId ? { projectId } : {};
  const items = await prisma.libraryItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { name: true, company: true } },
    },
  });
  return Response.json(items);
}

type CreateBody = {
  title: string;
  projectId?: string | null;
  area: string;
  requirementsSummary: string;
  artifactType: string;
  artifactSnippet?: string | null;
};

export async function POST(req: Request) {
  const body = (await req.json()) as CreateBody;
  const title = body.title?.trim();
  const area = body.area?.trim() || "software";
  const requirementsSummary = body.requirementsSummary?.trim();
  const artifactType = body.artifactType?.trim() || "artifact";
  if (!title || !requirementsSummary) {
    return Response.json(
      { error: "title and requirementsSummary are required" },
      { status: 400 }
    );
  }
  const item = await prisma.libraryItem.create({
    data: {
      title,
      projectId: body.projectId?.trim() || null,
      area,
      requirementsSummary,
      artifactType,
      artifactSnippet: body.artifactSnippet?.trim() || null,
    },
    include: {
      project: { select: { name: true, company: true } },
    },
  });
  return Response.json(item);
}
