import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { assessmentLabel } from "@/lib/labels";
import { parseLocalDay, toClinicDayString, todayClinicDay } from "@/lib/dates";
import { isNotApplicableAnswer } from "@/lib/notApplicable";

type AnswerLike = {
  questionId: string;
  selectedValues: string[];
  textValue: string | null;
  ratingValue: number | null;
  reason: string | null;
  isNegative: boolean;
};

function answerText(a: AnswerLike): string {
  if (a.ratingValue != null) return String(a.ratingValue);
  if (a.selectedValues?.length) return a.selectedValues.join(", ");
  if (a.textValue) return a.textValue;
  return "";
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");
  const fromDate = parseLocalDay(fromRaw || todayClinicDay());
  const toDate = parseLocalDay(toRaw || todayClinicDay());

  const activeForm = await prisma.questionnaire.findFirst({
    where: { active: true },
    include: {
      questions: {
        orderBy: { order: "asc" },
        select: { id: true, text: true, order: true },
      },
    },
  });

  let columnQuestions = activeForm?.questions ?? [];

  const surveys = await prisma.survey.findMany({
    where: {
      surveyDate: { gte: fromDate, lte: toDate },
      ...(session.user.role === "HEAD_NURSE" && session.user.departmentId
        ? { patient: { departmentId: session.user.departmentId } }
        : {}),
    },
    include: {
      patient: {
        select: {
          fullName: true,
          departmentName: true,
          historyNumber: true,
          personalId: true,
          age: true,
          doctorName: true,
        },
      },
      author: { select: { name: true } },
      answers: {
        include: {
          question: { select: { id: true, text: true, type: true, order: true } },
        },
        orderBy: { question: { order: "asc" } },
      },
    },
    orderBy: [{ surveyDate: "desc" }, { updatedAt: "desc" }],
    take: 5000,
  });

  if (columnQuestions.length === 0 && surveys.length > 0) {
    const seen = new Map<string, { id: string; text: string; order: number }>();
    for (const s of surveys) {
      for (const a of s.answers) {
        if (!a.question) continue;
        seen.set(a.question.id, {
          id: a.question.id,
          text: a.question.text,
          order: a.question.order,
        });
      }
    }
    columnQuestions = [...seen.values()].sort((a, b) => a.order - b.order);
  }

  const headerRow: string[] = [
    "თარიღი",
    "პაციენტი",
    "პირადი_ნომერი",
    "ისტორია",
    "ასაკი",
    "განყოფილება",
    "ექიმი",
    "შეფასება",
    "გამომკითხველი",
    "კომენტარი",
  ];

  for (let i = 0; i < columnQuestions.length; i++) {
    const n = i + 1;
    const q = columnQuestions[i];
    headerRow.push(`${n}. ${q.text}`);
    headerRow.push(`მიზეზი(${n})`);
  }

  const dataRows: unknown[][] = [];

  for (const s of surveys) {
    const byQuestionId = new Map(s.answers.map((a) => [a.questionId, a]));

    const row: unknown[] = [
      toClinicDayString(s.surveyDate),
      s.patient.fullName,
      s.patient.personalId || "",
      s.patient.historyNumber || "",
      s.patient.age ?? "",
      s.patient.departmentName || "",
      s.patient.doctorName || "",
      assessmentLabel(s.assessment),
      s.author.name,
      s.comment || "",
    ];

    for (const q of columnQuestions) {
      const a = byQuestionId.get(q.id);
      if (!a || isNotApplicableAnswer(a)) {
        row.push("", "");
        continue;
      }
      row.push(answerText(a));
      const reason =
        a.isNegative && a.reason && String(a.reason).trim() !== ""
          ? String(a.reason).trim()
          : "";
      row.push(reason);
    }

    dataRows.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "შედეგები");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const fromStr = toClinicDayString(fromDate);
  const toStr = toClinicDayString(toDate);
  const fname = `psi-reports-${fromStr}-${toStr}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
