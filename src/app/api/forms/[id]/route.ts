import { NextResponse } from "next/server";
import { auth, canManageForms } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { QuestionType } from "@prisma/client";

type OptionInput = {
  label: string;
  value?: string;
  order?: number;
  isNegative?: boolean;
  requireReason?: boolean;
};

type QuestionInput = {
  id?: string;
  text: string;
  type: QuestionType;
  required?: boolean;
  order?: number;
  ratingMin?: number;
  ratingMax?: number;
  options?: OptionInput[];
};

const formInclude = {
  questions: {
    include: { options: { orderBy: { order: "asc" as const } } },
    orderBy: { order: "asc" as const },
  },
  _count: { select: { surveys: true } },
};

type DbClient = typeof prisma;

async function createQuestions(
  db: DbClient,
  questionnaireId: string,
  questions: QuestionInput[],
) {
  for (const [index, q] of questions.entries()) {
    await db.question.create({
      data: {
        questionnaireId,
        text: q.text,
        type: q.type,
        required: q.required ?? true,
        order: q.order ?? index + 1,
        ratingMin: q.ratingMin ?? 1,
        ratingMax: q.ratingMax ?? 5,
        options: {
          create: (q.options || []).map((o, oi) => ({
            label: o.label,
            value: o.value || o.label,
            order: o.order ?? oi + 1,
            isNegative: Boolean(o.isNegative),
            requireReason: Boolean(o.requireReason),
          })),
        },
      },
    });
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageForms(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const form = await prisma.questionnaire.findUnique({
    where: { id },
    include: formInclude,
  });
  if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(form);
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !canManageForms(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json();

  const existing = await prisma.questionnaire.findUnique({
    where: { id },
    include: { _count: { select: { surveys: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const questions = Array.isArray(body.questions)
    ? (body.questions as QuestionInput[])
    : null;

  if (questions && existing._count.surveys > 0) {
    const rootId = existing.parentId || existing.id;
    const siblings = await prisma.questionnaire.findMany({
      where: { OR: [{ id: rootId }, { parentId: rootId }] },
      select: { version: true },
    });
    const nextVersion =
      Math.max(existing.version, ...siblings.map((s) => s.version)) + 1;
    const makeActive = body.active !== false;

    const created = await prisma.questionnaire.create({
      data: {
        title: String(body.title || existing.title).trim() || existing.title,
        description:
          body.description !== undefined
            ? body.description || null
            : existing.description,
        active: makeActive,
        version: nextVersion,
        parentId: rootId,
      },
    });

    if (makeActive) {
      await prisma.questionnaire.updateMany({
        where: { id: { not: created.id } },
        data: { active: false },
      });
    }

    await createQuestions(prisma, created.id, questions);

    const form = await prisma.questionnaire.findUnique({
      where: { id: created.id },
      include: formInclude,
    });
    return NextResponse.json({ ...form, versioned: true });
  }

  await prisma.questionnaire.update({
    where: { id },
    data: {
      title: body.title,
      description: body.description ?? null,
      active: Boolean(body.active),
    },
  });

  if (body.active) {
    await prisma.questionnaire.updateMany({
      where: { id: { not: id } },
      data: { active: false },
    });
  }

  if (questions) {
    await prisma.question.deleteMany({ where: { questionnaireId: id } });
    await createQuestions(prisma, id, questions);
  }

  const form = await prisma.questionnaire.findUnique({
    where: { id },
    include: formInclude,
  });

  return NextResponse.json(form);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !canManageForms(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const surveys = await prisma.survey.count({ where: { questionnaireId: id } });
  if (surveys > 0) {
    return NextResponse.json(
      {
        error:
          "ამ კითხვარზე უკვე არის გამოკითხვები — წაშლა არ შეიძლება. შეცვალეთ და შეინახეთ ახალი ვერსია.",
      },
      { status: 409 },
    );
  }

  await prisma.questionnaire.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
