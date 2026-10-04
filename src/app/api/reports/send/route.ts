import { NextResponse } from "next/server";
import { AssessmentLevel } from "@prisma/client";
import { auth, canSendReports } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildAggregateEmail, countByAssessment, sendMail } from "@/lib/email";
import { topProblemsByAssessment } from "@/lib/problems";
import { rosterDayFromParam } from "@/lib/dates";

/** ხელით დღის ანგარიშის გაგზავნა */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canSendReports(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const day = rosterDayFromParam(body.date ? String(body.date) : undefined);

  const rosterTotal = await prisma.dailyRoster.count({ where: { date: day } });

  const surveys = await prisma.survey.findMany({
    where: { surveyDate: day },
    select: {
      assessment: true,
      abstainReason: true,
      answers: {
        select: {
          isNegative: true,
          reason: true,
          question: { select: { text: true } },
        },
      },
    },
  });

  const activeForm = await prisma.questionnaire.findFirst({
    where: { active: true },
    include: {
      questions: { orderBy: { order: "asc" }, select: { text: true } },
    },
  });
  const questionTexts = (activeForm?.questions || [])
    .map((q) => q.text.trim())
    .filter(Boolean)
    .slice(0, 8);

  const counts = countByAssessment(surveys);
  const attentionProblems = topProblemsByAssessment(
    surveys,
    AssessmentLevel.ATTENTION,
    8,
    questionTexts,
  );
  const fixProblems = topProblemsByAssessment(
    surveys,
    AssessmentLevel.FIX_NEEDED,
    8,
    questionTexts,
  );

  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const { subject, body: text, to } = buildAggregateEmail(
    {
      date: day,
      rosterTotal,
      ...counts,
      attentionProblems,
      fixProblems,
    },
    appUrl,
  );

  if (to.length === 0) {
    return NextResponse.json({ error: "მიმღებები არ არის მითითებული" }, { status: 400 });
  }

  try {
    const result = await sendMail(to, subject, text);
    await prisma.emailLog.create({
      data: {
        surveyDate: day,
        recipients: to,
        subject,
        body: text,
        success: true,
        error: result.skipped ? "SMTP არ არის კონფიგურირებული — ლოგში შენახულია" : null,
      },
    });
    return NextResponse.json({
      ok: true,
      rosterTotal,
      ...counts,
      attentionProblems,
      fixProblems,
      skipped: result.skipped,
      to,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "გაგზავნის შეცდომა";
    await prisma.emailLog.create({
      data: {
        surveyDate: day,
        recipients: to,
        subject,
        body: text,
        success: false,
        error: message,
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
