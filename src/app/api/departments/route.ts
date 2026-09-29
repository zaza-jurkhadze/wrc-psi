import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rows = await prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ ok: true, rows, departments: rows });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "შეცდომა" },
      { status: 500 },
    );
  }
}
