import { prisma } from "./prisma";
import type { ImportedPatientRow } from "./excel";
import { parseLocalDay, localDateISO } from "./dates";

export async function upsertPatientsToRoster(
  rows: ImportedPatientRow[],
  source: string,
  rosterDate?: Date,
) {
  const day = rosterDate ?? parseLocalDay(localDateISO());
  let count = 0;
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    let departmentId: string | null = null;
    if (row.departmentName) {
      const dep = await prisma.department.upsert({
        where: { name: row.departmentName },
        create: { name: row.departmentName },
        update: {},
      });
      departmentId = dep.id;
    }

    let patient: null | { id: string; personalId: string | null; historyNumber: string | null } = null;
    const whereParts: Array<
      | { historyNumber: string }
      | { personalId: string }
    > = [];
    if (row.historyNumber) whereParts.push({ historyNumber: row.historyNumber });
    if (row.personalId) whereParts.push({ personalId: row.personalId });

    if (whereParts.length > 0) {
      patient = await prisma.patient.findFirst({
        where: { OR: whereParts },
      });
    }

    if (patient) {
      patient = await prisma.patient.update({
        where: { id: patient.id },
        data: {
          personalId: row.personalId ?? patient.personalId,
          fullName: row.fullName,
          birthDate: row.birthDate,
          age: row.age,
          mobile: row.mobile,
          historyNumber: row.historyNumber ?? patient.historyNumber,
          careType: row.careType,
          openedAt: row.openedAt,
          closedAt: row.closedAt,
          dischargedAt: row.dischargedAt,
          doctorName: row.doctorName,
          departmentName: row.departmentName,
          departmentId,
          source,
        },
      });
      updated += 1;
    } else {
      patient = await prisma.patient.create({
        data: {
          personalId: row.personalId,
          fullName: row.fullName,
          birthDate: row.birthDate,
          age: row.age,
          mobile: row.mobile,
          historyNumber: row.historyNumber,
          careType: row.careType,
          openedAt: row.openedAt,
          closedAt: row.closedAt,
          dischargedAt: row.dischargedAt,
          doctorName: row.doctorName,
          departmentName: row.departmentName,
          departmentId,
          source,
        },
      });
      created += 1;
    }

    await prisma.dailyRoster.upsert({
      where: {
        patientId_date: { patientId: patient.id, date: day },
      },
      create: { patientId: patient.id, date: day },
      update: {},
    });

    count += 1;
  }

  await prisma.syncLog.create({
    data: {
      source,
      message: `ჩაიტვირთა ${count} პაციენტი (ახალი: ${created}, განახლებული: ${updated})`,
      count,
      success: true,
    },
  });

  return { count, created, updated };
}
