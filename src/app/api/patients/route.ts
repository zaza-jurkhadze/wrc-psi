import { NextResponse } from "next/server";
import { auth, canManageDailyRoster, canSeeAllDepartments } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { localDateISO, parseLocalDay, rosterDayFromParam, toClinicDayString, todayClinicDay } from "@/lib/dates";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const day = rosterDayFromParam(searchParams.get("date"));
  const role = session.user.role;

  const patientWhereFilter: {
    OR?: Array<
      | { fullName: { contains: string; mode: "insensitive" } }
      | { personalId: { contains: string } }
      | { historyNumber: { contains: string } }
      | { departmentName: { contains: string; mode: "insensitive" } }
    >;
    departmentId?: string;
  } = {};
  if (q) {
    patientWhereFilter.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { personalId: { contains: q } },
      { historyNumber: { contains: q } },
      { departmentName: { contains: q, mode: "insensitive" } },
    ];
  }
  if (!canSeeAllDepartments(role) && session.user.departmentId) {
    patientWhereFilter.departmentId = session.user.departmentId;
  }

  const roster = await prisma.dailyRoster.findMany({
    where: {
      date: day,
      patient: Object.keys(patientWhereFilter).length > 0 ? patientWhereFilter : undefined,
    },
    include: {
      patient: {
        include: {
          surveys: {
            where: { surveyDate: day },
            select: { id: true, assessment: true },
          },
        },
      },
    },
    orderBy: [
      { patient: { departmentName: "asc" } },
      { patient: { fullName: "asc" } },
    ],
  });

  return NextResponse.json({
    date: day.toISOString(),
    patients: roster.map((r) => ({
      ...r.patient,
      surveyedToday: r.patient.surveys.length > 0,
      todaySurveyId: r.patient.surveys[0]?.id ?? null,
      todayAssessment: r.patient.surveys[0]?.assessment ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !canManageDailyRoster(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const requestedDay = body.surveyDate
    ? rosterDayFromParam(String(body.surveyDate))
    : parseLocalDay(localDateISO());
  if (toClinicDayString(requestedDay) !== todayClinicDay()) {
    return NextResponse.json(
      { error: "წინა დღის სიაში პაციენტის დამატება არ შეიძლება" },
      { status: 403 },
    );
  }

  const fullName = String(body.fullName || "").trim();
  if (!fullName) {
    return NextResponse.json({ error: "სახელი და გვარი სავალდებულოა" }, { status: 400 });
  }
  if (!/^[\p{L}\s'\-]+$/u.test(fullName)) {
    return NextResponse.json(
      { error: "სახელსა და გვარში მხოლოდ ასოებია დაშვებული" },
      { status: 400 },
    );
  }

  const personalIdRaw = String(body.personalId || "").trim();
  if (!personalIdRaw) {
    return NextResponse.json({ error: "პირადი ნომერი სავალდებულოა" }, { status: 400 });
  }
  if (!/^\d+$/.test(personalIdRaw)) {
    return NextResponse.json(
      { error: "პირად ნომერში მხოლოდ ციფრებია დაშვებული" },
      { status: 400 },
    );
  }

  const departmentName = String(body.departmentName || "").trim();
  let departmentId: string | null = null;
  if (departmentName) {
    const dep = await prisma.department.upsert({
      where: { name: departmentName },
      create: { name: departmentName },
      update: {},
    });
    departmentId = dep.id;
  }

  const historyNumber = String(body.historyNumber || "").trim();
  if (!historyNumber) {
    return NextResponse.json({ error: "ისტორიის ნომერი სავალდებულოა" }, { status: 400 });
  }

  const patient = await prisma.patient.create({
    data: {
      fullName,
      personalId: personalIdRaw || null,
      birthDate: body.birthDate ? new Date(body.birthDate) : null,
      age: body.age != null ? Number(body.age) : null,
      mobile: body.mobile || null,
      historyNumber,
      careType: body.careType || null,
      doctorName: body.doctorName || null,
      departmentName: departmentName || null,
      departmentId,
      source: "manual",
    },
  });

  const day = requestedDay;
  await prisma.dailyRoster.upsert({
    where: { patientId_date: { patientId: patient.id, date: day } },
    create: { patientId: patient.id, date: day },
    update: {},
  });

  return NextResponse.json(patient);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user || !canManageDailyRoster(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const idsRaw = body.ids || (body.id ? [body.id] : []);
  const ids = Array.isArray(idsRaw)
    ? idsRaw.map((x) => String(x)).filter(Boolean)
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "ids სავალდებულოა" }, { status: 400 });
  }

  const day = rosterDayFromParam(body.date ? String(body.date) : undefined);
  if (toClinicDayString(day) !== todayClinicDay()) {
    return NextResponse.json(
      { error: "წინა დღის სიიდან ამოღება არ შეიძლება" },
      { status: 403 },
    );
  }

  const surveyedOnDay = await prisma.survey.findMany({
    where: { patientId: { in: ids }, surveyDate: day },
    select: { patientId: true },
  });
  const surveyedIds = new Set(surveyedOnDay.map((s) => s.patientId));
  const safeIds = ids.filter((id) => !surveyedIds.has(id));
  const skipped = ids.length - safeIds.length;

  const removed =
    safeIds.length > 0
      ? await prisma.dailyRoster.deleteMany({
          where: { patientId: { in: safeIds }, date: day },
        })
      : { count: 0 };

  return NextResponse.json({
    count: removed.count,
    skipped,
    skippedIds: ids.filter((id) => surveyedIds.has(id)),
  });
}
