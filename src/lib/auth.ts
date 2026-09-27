import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: Role;
    departmentId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      departmentId?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    departmentId?: string | null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").toLowerCase().trim();
        const password = String(credentials?.password || "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) return null;

        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          departmentId: user.departmentId,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.departmentId = user.departmentId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.departmentId = token.departmentId;
      }
      return session;
    },
  },
  trustHost: true,
});

export function canEditAnySurvey(role: Role) {
  return (
    role === "ADMIN" ||
    role === "QUALITY_MANAGER" ||
    role === "MEDICAL_DIRECTOR" ||
    role === "GENERAL_DIRECTOR"
  );
}

export function canManageForms(role: Role) {
  return (
    role === "ADMIN" ||
    role === "QUALITY_MANAGER" ||
    role === "MEDICAL_DIRECTOR" ||
    role === "GENERAL_DIRECTOR"
  );
}

export function canManageDailyRoster(role: Role) {
  return role === "ADMIN" || role === "QUALITY_MANAGER" || role === "INTERVIEWER";
}

export function canSeeAllDepartments(role: Role) {
  return (
    role === "ADMIN" ||
    role === "QUALITY_MANAGER" ||
    role === "MEDICAL_DIRECTOR" ||
    role === "GENERAL_DIRECTOR"
  );
}
