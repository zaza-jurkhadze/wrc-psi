import { NextResponse } from "next/server";
import { auth, canManageForms } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageForms(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const forms = await prisma.questionnaire.findMany({
    include: {
      questions: {
        include: { options: { orderBy: { order: "asc" } } },
        orderBy: { order: "asc" },
      },
      _count: { select: { surveys: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(forms);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !canManageForms(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const title = String(body.title || "").trim();
  if (!title) return NextResponse.json({ error: "სათაური სავალდებულოა" }, { status: 400 });

  const form = await prisma.questionnaire.create({
    data: {
      title,
      description: body.description || null,
      active: Boolean(body.active),
    },
  });

  if (body.active) {
    await prisma.questionnaire.updateMany({
      where: { id: { not: form.id } },
      data: { active: false },
    });
  }

  return NextResponse.json(form);
}
