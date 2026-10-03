import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await prisma.questionnaire.findFirst({
      where: { active: true },
      include: {
        questions: {
          include: { options: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!form) {
      return NextResponse.json(
        { error: "აქტიური კითხვარი არ არის" },
        { status: 404 },
      );
    }

    return NextResponse.json(form);
  } catch (e) {
    console.error("[GET /api/forms/active]", e);
    const message =
      e instanceof Error ? e.message : "აქტიური კითხვარის ჩატვირთვა ვერ მოხერხდა";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
