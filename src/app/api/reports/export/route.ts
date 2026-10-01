import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { assessmentLabel } from "@/lib/labels";
import { parseLocalDay, toClinicDayString, todayClinicDay } from "@/lib/dates";
import { isNotApplicableAnswer } from "@/lib/notApplicable";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");
  const fromDate = parseLocalDay(fromRaw || todayClinicDay());
  const toDate = parseLocalDay(toRaw || todayClinicDay());

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
        include: { question: { select: { text: true, type: true } } },
        orderBy: { question: { order: "asc" } },
      },
    },
    orderBy: [{ surveyDate: "desc" }, { updatedAt: "desc" }],
    take: 5000,
  });

  const rows: Record<string, unknown>[] = [];

  for (const s of surveys) {
    const base: Record<string, unknown> = {
      თარიღი: toClinicDayString(s.surveyDate),
      პაციენტი: s.patient.fullName,
      პირადი_ნომერი: s.patient.personalId || "",
      ისტორია: s.patient.historyNumber || "",
      ასაკი: s.patient.age ?? "",
      განყოფილება: s.patient.departmentName || "",
      ექიმი: s.patient.doctorName || "",
      შეფასება: assessmentLabel(s.assessment),
      გამომკითხველი: s.author.name,
      კომენტარი: s.comment || "",
    };

    s.answers.forEach((a, idx) => {
      if (isNotApplicableAnswer(a)) return;

      let answerText = "";
      if (a.ratingValue != null) answerText = String(a.ratingValue);
      else if (a.selectedValues && a.selectedValues.length > 0)
        answerText = a.selectedValues.join(", ");
      else if (a.textValue) answerText = a.textValue;

      const qText = a.question?.text || `კითხვა ${idx + 1}`;
      base[`${idx + 1}. ${qText}`] = answerText;
      if (a.reason) base[`${idx + 1}. მიზეზი`] = a.reason;
    });

    rows.push(base);
  }

  const ws = XLSX.utils.json_to_sheet(rows);
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
