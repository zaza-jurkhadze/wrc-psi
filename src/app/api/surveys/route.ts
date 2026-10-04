import { NextResponse } from "next/server";
import { auth, canEditAnySurvey, canCreateSurvey } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeAssessment, type AnswerInput } from "@/lib/assessment";
import {
  parseAbstainReason,
  type AbstainReason,
} from "@/lib/abstainReason";
import { rosterDayFromParam, toClinicDayString, todayClinicDay } from "@/lib/dates";

function abstainReasonFromBody(body: {
  abstainReason?: unknown;
}): AbstainReason {
  return parseAbstainReason(body.abstainReason) ?? "SELF";
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId");
  const dateParam = searchParams.get("date");
  const day = rosterDayFromParam(dateParam);
  const role = session.user.role;
  const canSeeAll =
    role === "ADMIN" ||
    role === "QUALITY_MANAGER" ||
    role === "MEDICAL_DIRECTOR" ||
    role === "GENERAL_DIRECTOR" ||
    role === "HEAD_NURSE";

  if (patientId) {
    const survey = await prisma.survey.findFirst({
      where: { patientId, surveyDate: day },
      include: {
        answers: true,
        questionnaire: {
          include: {
            questions: {
              include: { options: { orderBy: { order: "asc" } } },
              orderBy: { order: "asc" },
            },
          },
        },
        author: { select: { name: true } },
        lastEditedBy: { select: { name: true } },
        patient: {
          select: { id: true, departmentId: true, fullName: true, departmentName: true },
        },
      },
    });
    if (survey && !canSeeAll && session.user.departmentId) {
      if (survey.patient?.departmentId !== session.user.departmentId) {
        return NextResponse.json(null);
      }
    }
    return NextResponse.json(survey);
  }

  const where: {
    surveyDate?: Date;
    patient?: { departmentId?: string };
  } = {};

  if (dateParam) where.surveyDate = day;

  if (!canSeeAll && session.user.departmentId) {
    where.patient = { departmentId: session.user.departmentId };
  }

  const surveys = await prisma.survey.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true,
          fullName: true,
          departmentName: true,
          historyNumber: true,
          personalId: true,
        },
      },
      author: { select: { name: true } },
      questionnaire: { select: { title: true } },
      answers: {
        select: {
          questionId: true,
          selectedValues: true,
          textValue: true,
          ratingValue: true,
          reason: true,
          isNegative: true,
          question: {
            select: {
              text: true,
              type: true,
            },
          },
        },
        orderBy: { question: { order: "asc" } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  return NextResponse.json(surveys);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "ავტორიზაცია სავალდებულოა" }, { status: 401 });
  if (!canCreateSurvey(session.user.role))
    return NextResponse.json({ error: "თქვენ არ გაქვთ პაციენტის გამოკითხვის უფლება" }, { status: 403 });

  const body = await req.json();
  const patientId = String(body.patientId || "");
  const comment = body.comment ? String(body.comment) : null;
  const abstained = Boolean(body.abstained);
  const answersIn = (body.answers || []) as AnswerInput[];
  const rawSurveyDate = body.surveyDate ? String(body.surveyDate) : undefined;
  const day = rosterDayFromParam(rawSurveyDate);

  if (toClinicDayString(day) !== todayClinicDay()) {
    return NextResponse.json(
      { error: "წინა დღის გამოკითხვა აღარ არის შესაძლებელი — მხოლოდ ნახვა" },
      { status: 403 },
    );
  }

  if (!patientId) {
    return NextResponse.json({ error: "პაციენტი სავალდებულოა" }, { status: 400 });
  }

  const questionnaire =
    (await prisma.questionnaire.findFirst({ where: { active: true } })) ||
    (await prisma.questionnaire.findFirst({ orderBy: { createdAt: "desc" } }));

  if (!questionnaire) {
    return NextResponse.json({ error: "აქტიური კითხვარი არ არის" }, { status: 400 });
  }

  const existing = await prisma.survey.findUnique({
    where: {
      patientId_surveyDate_questionnaireId: {
        patientId,
        surveyDate: day,
        questionnaireId: questionnaire.id,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "ამ პაციენტს დღეს უკვე აქვს გამოკითხვა — გამოიყენეთ რედაქტირება", surveyId: existing.id },
      { status: 409 },
    );
  }

  if (abstained) {
    try {
      const survey = await prisma.survey.create({
        data: {
          patientId,
          questionnaireId: questionnaire.id,
          surveyDate: day,
          comment,
          assessment: "ABSTAINED" as never,
          abstainReason: abstainReasonFromBody(body),
          authorId: session.user.id,
        },
      });
      return NextResponse.json(survey);
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code: string }).code === "P2002"
      ) {
        const conflict = await prisma.survey.findFirst({
          where: { patientId, surveyDate: day, questionnaireId: questionnaire.id },
        });
        return NextResponse.json(
          {
            error: "ამ პაციენტს დღეს უკვე აქვს გამოკითხვა — გამოიყენეთ რედაქტირება",
            surveyId: conflict?.id,
          },
          { status: 409 },
        );
      }
      throw e;
    }
  }

  const questions = await prisma.question.findMany({
    where: { questionnaireId: questionnaire.id },
    include: { options: true },
  });

  let normalized;
  let assessment;
  try {
    normalized = normalizeAnswers(answersIn, questions);
    assessment = computeAssessment(normalized);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "პასუხების შეცდომა" },
      { status: 400 },
    );
  }

  try {
    const survey = await prisma.survey.create({
      data: {
        patientId,
        questionnaireId: questionnaire.id,
        surveyDate: day,
        comment,
        assessment,
        authorId: session.user.id,
        answers: {
          create: normalized.map((a) => ({
            questionId: a.questionId,
            selectedValues: a.selectedValues,
            textValue: a.textValue,
            ratingValue: a.ratingValue,
            reason: a.reason,
            isNegative: a.isNegative,
          })),
        },
      },
    });
    return NextResponse.json(survey);
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      const conflict = await prisma.survey.findFirst({
        where: { patientId, surveyDate: day, questionnaireId: questionnaire.id },
      });
      return NextResponse.json(
        {
          error: "ამ პაციენტს დღეს უკვე აქვს გამოკითხვა — გამოიყენეთ რედაქტირება",
          surveyId: conflict?.id,
        },
        { status: 409 },
      );
    }
    throw e;
  }
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const surveyId = String(body.surveyId || "");
  if (!surveyId) return NextResponse.json({ error: "surveyId სავალდებულოა" }, { status: 400 });

  const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!survey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rawSurveyDate = body.surveyDate ? String(body.surveyDate) : undefined;
  const day = rosterDayFromParam(rawSurveyDate);

  if (toClinicDayString(day) !== todayClinicDay()) {
    return NextResponse.json(
      { error: "წინა დღის გამოკითხვა აღარ არის შესაძლებელი — მხოლოდ ნახვა" },
      { status: 403 },
    );
  }

  const canEdit =
    canEditAnySurvey(session.user.role) ||
    session.user.id === survey.authorId;

  if (!canEdit) {
    return NextResponse.json({ error: "რედაქტირება არ არის ნებადართული" }, { status: 403 });
  }

  const questions = await prisma.question.findMany({
    where: { questionnaireId: survey.questionnaireId },
    include: { options: true },
  });

  const abstained = Boolean(body.abstained);

  if (abstained) {
    const commentData =
      body.comment != null ? String(body.comment) : survey.comment;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.answer.deleteMany({ where: { surveyId } });
      return tx.survey.update({
        where: { id: surveyId },
        data: {
          comment: commentData,
          assessment: "ABSTAINED" as never,
          abstainReason: abstainReasonFromBody(body),
          lastEditedById: session.user.id,
        },
      });
    });
    return NextResponse.json(updated);
  }

  let normalized;
  let assessment;
  try {
    normalized = normalizeAnswers((body.answers || []) as AnswerInput[], questions);
    assessment = computeAssessment(normalized);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "პასუხების შეცდომა" },
      { status: 400 },
    );
  }

  const commentData =
    body.comment != null ? String(body.comment) : survey.comment;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.answer.deleteMany({ where: { surveyId } });
    return tx.survey.update({
      where: { id: surveyId },
      data: {
        comment: commentData,
        assessment,
        abstainReason: null,
        lastEditedById: session.user.id,
        answers: {
          create: normalized.map((a) => ({
            questionId: a.questionId,
            selectedValues: a.selectedValues,
            textValue: a.textValue,
            ratingValue: a.ratingValue,
            reason: a.reason,
            isNegative: a.isNegative,
          })),
        },
      },
    });
  });

  return NextResponse.json(updated);
}

function normalizeAnswers(
  answersIn: AnswerInput[],
  questions: {
    id: string;
    text: string;
    type: string;
    required: boolean;
    ratingMin: number | null;
    ratingMax: number | null;
    options: { value: string; isNegative: boolean; requireReason: boolean }[];
  }[],
): AnswerInput[] {
  return questions.map((q, idx) => {
    const pos = idx + 1;
    const label = `კითხვა #${pos} (${q.text})`;
    const raw = answersIn.find((a) => a.questionId === q.id);
    const selectedValues = (raw?.selectedValues || []).filter((v) => v != null && v !== "");
    const ratingValue =
      raw && (raw.ratingValue === 0 || raw.ratingValue) ? Number(raw.ratingValue) : null;
    const textValueRaw = raw?.textValue;
    const textValue =
      textValueRaw != null && String(textValueRaw).trim() !== ""
        ? String(textValueRaw)
        : null;

    const isRequired = q.required !== false;

    if (q.type === "SINGLE_CHOICE") {
      if (selectedValues.length !== 1) {
        if (isRequired) throw new Error(`${label}: აირჩიეთ 1 პასუხი`);
      }
    } else if (q.type === "MULTI_CHOICE") {
      if (selectedValues.length === 0) {
        if (isRequired) throw new Error(`${label}: აირჩიეთ მინიმუმ 1 პასუხი`);
      }
    } else if (q.type === "RATING") {
      const min = q.ratingMin ?? 1;
      const max = q.ratingMax ?? 5;
      if (ratingValue == null || Number.isNaN(ratingValue)) {
        if (isRequired) throw new Error(`${label}: აუცილებელია შეფასების მითითება`);
      } else if (ratingValue < min || ratingValue > max) {
        throw new Error(`${label}: შეფასება უნდა იყოს ${min}–${max} საზრაში`);
      }
    } else if (q.type === "SHORT_TEXT" || q.type === "LONG_TEXT") {
      if (!textValue && isRequired) {
        throw new Error(`${label}: აუცილებელია ტექსტის შევსება`);
      }
    }

    let isNegative = false;
    let requireReason = false;
    if (q.type === "RATING") {
      const max = q.ratingMax ?? 5;
      if (ratingValue! <= Math.ceil(max * 0.4)) isNegative = true;
      if (isNegative) requireReason = true;
    } else {
      for (const v of selectedValues) {
        const opt = q.options.find((o) => o.value === v);
        if (opt?.isNegative) isNegative = true;
        if (opt?.requireReason) requireReason = true;
      }
    }

    const reason = raw?.reason && String(raw.reason).trim() !== "" ? String(raw.reason) : null;
    if (requireReason && isNegative && !reason) {
      throw new Error(`${label}: უარყოფითი პასუხისთვის მიზეზი სავალდებულოა`);
    }

    return {
      questionId: q.id,
      selectedValues,
      textValue,
      ratingValue,
      reason,
      isNegative,
    };
  });
}
