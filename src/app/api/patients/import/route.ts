import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parsePatientsExcel } from "@/lib/excel";
import { upsertPatientsToRoster } from "@/lib/patients";
import { rosterDayFromParam, toClinicDayString, todayClinicDay } from "@/lib/dates";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ფაილი არ არის" }, { status: 400 });
  }

  const day = rosterDayFromParam(
    typeof form.get("date") === "string" ? String(form.get("date")) : undefined,
  );
  if (toClinicDayString(day) !== todayClinicDay()) {
    return NextResponse.json(
      { error: "წინა დღის სიაში იმპორტი არ შეიძლება" },
      { status: 403 },
    );
  }

  const buffer = await file.arrayBuffer();
  const rows = parsePatientsExcel(buffer);
  if (rows.length === 0) {
    return NextResponse.json({ error: "ფაილში პაციენტები ვერ მოიძებნა" }, { status: 400 });
  }

  const result = await upsertPatientsToRoster(rows, "excel", day);
  return NextResponse.json({ ok: true, ...result });
}
