import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EDITABLE_ROLES = [
  "INTERVIEWER",
  "HEAD_NURSE",
  "QUALITY_MANAGER",
  "MEDICAL_DIRECTOR",
  "GENERAL_DIRECTOR",
  "ADMIN",
] as const;
type EditableRole = (typeof EDITABLE_ROLES)[number];

const PASSWORD_REQUIRED_SYMBOLS = "!@#$%^&*";

function validatePassword(raw: string): { ok: boolean; reason?: string } {
  if (!raw || raw.length < 6) {
    return { ok: false, reason: "პაროლი არიან მინიმუმ 6 სიმბოლო" };
  }
  if (!/[A-Z]/.test(raw)) {
    return { ok: false, reason: "სავალდებულოა მინიმუმ ერთი დიდი ასო (A–Z)" };
  }
  if (!/[0-9]/.test(raw)) {
    return { ok: false, reason: "სავალდებულოა მინიმუმ ერთი ციფრი (0–9)" };
  }
  const hasSymbol = PASSWORD_REQUIRED_SYMBOLS.split("").some((s) => raw.includes(s));
  if (!hasSymbol) {
    return {
      ok: false,
      reason: `სავალდებულოა მინიმუმ ერთი სიმბოლო (მაგ. ${PASSWORD_REQUIRED_SYMBOLS.slice(0, 8).split("").join(" ")})`,
    };
  }
  return { ok: true };
}

function isAdmin(sessionUser: { id?: string; role?: string } | undefined) {
  return !!sessionUser && sessionUser.role === "ADMIN";
}

function parseRole(raw: unknown): EditableRole {
  if (typeof raw === "string" && (EDITABLE_ROLES as readonly string[]).includes(raw)) {
    return raw as EditableRole;
  }
  throw new Error("არასწორი როლი");
}

async function currentUserIdOrThrow() {
  const session = await auth();
  if (!isAdmin(session?.user)) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  return {
    currentUserId: session!.user!.id,
  };
}

export async function GET() {
  try {
    const { currentUserId } = await currentUserIdOrThrow();
    const rows = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
    return NextResponse.json({
      ok: true,
      rows: rows.map((r) => ({
        ...r,
        isSelf: r.id === currentUserId,
      })),
    });
  } catch (e) {
    const status = (e as { status?: number }).status || 500;
    return NextResponse.json(
      { error: (e as Error).message || "შეცდომა" },
      { status },
    );
  }
}

export async function POST(req: Request) {
  try {
    const { currentUserId } = await currentUserIdOrThrow();
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      name?: string;
      password?: string;
      role?: string;
      departmentId?: string | null;
      active?: boolean;
    };
    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim();
    const password = body.password;
    const role = parseRole(body.role);
    const active = typeof body.active === "boolean" ? body.active : true;
    const departmentId = body.departmentId || null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("სწორი ელფოსტა საჭიროა");
    }
    if (!name || name.length < 2) {
      throw new Error("სახელი საჭიროა (მინიმუმ 2 სიმბოლო)");
    }
    if (!password || password.length < 6) {
      throw new Error("პაროლი საჭიროა (მინიმუმ 6 სიმბოლო)");
    }
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) {
      throw new Error(passwordCheck.reason || "პაროლი სუსტია");
    }
    const passwordHash = await hash(password, 10);

    try {
      const created = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          role,
          active,
          departmentId,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
          createdAt: true,
        },
      });
      return NextResponse.json({
        ok: true,
        user: { ...created, isSelf: created.id === currentUserId },
      });
    } catch (dbErr) {
      const msg = (dbErr as { message?: string }).message || "";
      if (msg.includes("Unique") && msg.toLowerCase().includes("email")) {
        throw new Error("ელფოსტა უკვე არსებობს");
      }
      throw dbErr;
    }
  } catch (e) {
    const status = (e as { status?: number }).status || 400;
    return NextResponse.json(
      { error: (e as Error).message || "შეცდომა" },
      { status },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { currentUserId } = await currentUserIdOrThrow();
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      email?: string;
      name?: string;
      password?: string;
      role?: string;
      departmentId?: string | null;
      active?: boolean;
    };
    const id = body.id;
    if (!id) throw new Error("მომხმარებელი არ არის მითითებული");
    if (id === currentUserId) {
      throw new Error("საკუთარი პროფილის რედაქტირება ზოგადი ადმინ პანელით არ შეიძლება");
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw Object.assign(new Error("მომხმარებელი არ მოიძებნა"), { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (body.email !== undefined) {
      const email = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("სწორი ელფოსტა საჭიროა");
      }
      data.email = email;
    }
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name || name.length < 2) throw new Error("სახელი საჭიროა");
      data.name = name;
    }
    if (body.role !== undefined) {
      data.role = parseRole(body.role);
    }
    if (body.departmentId !== undefined) {
      data.departmentId = body.departmentId || null;
    }
    if (typeof body.active === "boolean") {
      data.active = body.active;
    }
    if (body.password) {
      const passwordCheck = validatePassword(body.password);
      if (!passwordCheck.ok) {
        throw new Error(passwordCheck.reason || "პაროლი სუსტია");
      }
      data.passwordHash = await hash(body.password, 10);
    }

    if (Object.keys(data).length === 0) {
      throw new Error("ცვლილება არ არის მითითებული");
    }

    try {
      const updated = await prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
          createdAt: true,
        },
      });
      return NextResponse.json({
        ok: true,
        user: { ...updated, isSelf: updated.id === currentUserId },
      });
    } catch (dbErr) {
      const msg = (dbErr as { message?: string }).message || "";
      if (msg.includes("RecordNotFound")) {
        throw Object.assign(new Error("მომხმარებელი არ მოიძებნა"), { status: 404 });
      }
      if (msg.includes("Unique") && msg.toLowerCase().includes("email")) {
        throw new Error("ელფოსტა უკვე არსებობს");
      }
      throw dbErr;
    }
  } catch (e) {
    const status = (e as { status?: number }).status || 400;
    return NextResponse.json(
      { error: (e as Error).message || "შეცდომა" },
      { status },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { currentUserId } = await currentUserIdOrThrow();
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    const id = body.id;
    if (!id) throw new Error("მომხმარებელი არ არის მითითებული");
    if (id === currentUserId) {
      throw new Error("საკუთარი თავი ვერ წაშლით");
    }

    const usage = await prisma.survey.findFirst({
      where: { OR: [{ authorId: id }, { lastEditedById: id }] },
      select: { id: true },
    });
    if (usage) {
      throw new Error(
        "მომხმარებელს უკვე აქვს გამოკითხვები. არ წაშალოთ — უმჯობესია აქტიურობა გამორთოთ (active = false).",
      );
    }

    try {
      await prisma.user.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    } catch (dbErr) {
      const msg = (dbErr as { message?: string }).message || "";
      if (msg.includes("RecordNotFound")) {
        throw Object.assign(new Error("მომხმარებელი არ მოიძებნა"), { status: 404 });
      }
      if (msg.includes("ForeignKey") || msg.toLowerCase().includes("constraint")) {
        throw new Error(
          "მომხმარებელი დაკავშირებულია სხვა მონაცემებთან. უმჯობესია აქტიურობა გამორთოთ.",
        );
      }
      throw dbErr;
    }
  } catch (e) {
    const status = (e as { status?: number }).status || 400;
    return NextResponse.json(
      { error: (e as Error).message || "შეცდომა" },
      { status },
    );
  }
}
