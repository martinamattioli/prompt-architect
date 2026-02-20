import { prisma } from "@/lib/db";

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      company: true,
    },
  });
  return Response.json(projects);
}

type CreateProjectBody = {
  name: string;
  company: string;
  techStack?: string | null;
  brandVoice?: string | null;
  archDecisions?: string | null;
};

export async function POST(req: Request) {
  const body = (await req.json()) as CreateProjectBody;
  const name = body.name?.trim();
  const company = body.company?.trim();
  if (!name || !company) {
    return Response.json(
      { error: "name and company are required" },
      { status: 400 }
    );
  }
  let slug = slugify(name) || "project";
  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing) {
    let n = 1;
    while (await prisma.project.findUnique({ where: { slug: `${slug}-${n}` } })) n++;
    slug = `${slug}-${n}`;
  }
  const project = await prisma.project.create({
    data: {
      name,
      slug,
      company,
      techStack: body.techStack?.trim() || null,
      brandVoice: body.brandVoice?.trim() || null,
      archDecisions: body.archDecisions?.trim() || null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      company: true,
    },
  });
  return Response.json(project);
}
