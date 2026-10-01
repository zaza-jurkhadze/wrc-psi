import { NextResponse } from "next/server";
import { auth, canUploadPatients } from "@/lib/auth";
import { parsePatientsExcel } from "@/lib/excel";
import { upsertPatientsToRoster } from "@/lib/patients";
import { rosterDayFromParam, toClinicDayString, todayClinicDay } from "@/lib/dates";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUploadPatients(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ფაილი არ არის" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `ფაილი ძალიან დიდია (მაქს. ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB)` },
      { status: 413 },
    );
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
