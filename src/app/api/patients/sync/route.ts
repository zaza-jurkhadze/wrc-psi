import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchPatientsFromHis } from "@/lib/his";
import { upsertPatientsToRoster } from "@/lib/patients";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await fetchPatientsFromHis();
    const result = await upsertPatientsToRoster(rows, "api");
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "სინქის შეცდომა";
    await prisma.syncLog.create({
      data: { source: "api", message, count: 0, success: false },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
